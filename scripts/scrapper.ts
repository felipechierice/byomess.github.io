import { spawnSync, execSync } from "child_process";
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import {
    Client,
    LatLng,
    PlaceDetailsResult,
    PlacesNearbyResult,
    RequestParams,
} from "@googlemaps/google-maps-services-js";

interface Config {
    GOOGLE_MAPS_API_KEY: string | undefined;
    DEFAULT_CENTER_ADDRESS: string;
    DEFAULT_RADIUS: number;
    UPDATE_URL: string;
    DEV: boolean;
}

// Configuration object with default values
const config: Config = {
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    DEFAULT_CENTER_ADDRESS: "Av. Lauro de Carvalho, 943 - Centro, Jaguariúna",
    DEFAULT_RADIUS: 500,
    UPDATE_URL: "https://byomess.github.io/scripts/scrapper.ts",
    DEV: process.env.DEV === "true",
};

// Enhanced error handling with custom error types
class GoogleMapsError extends Error {
    constructor(message: string) {
        super(`Google Maps Error: ${message}`);
        this.name = "GoogleMapsError";
    }
}

class UpdateError extends Error {
    constructor(message: string) {
        super(`Update Error: ${message}`);
        this.name = "UpdateError";
    }
}

class FileError extends Error {
    constructor(message: string) {
        super(`File Error: ${message}`);
        this.name = "FileError";
    }
}

// Service class for Google Maps operations
class GoogleMapsService {
    private client: Client;
    
    constructor() {
        this.client = new Client({});
    }
    
    // Initialize dependencies (if necessary) - not needed here as constructor is synchronous
    // async initialize(): Promise<void> {}
    
    // Utility method to handle Google Maps API requests
    private async handleRequest<T>(
        requestFn: (params: RequestParams) => Promise<{ data: T }>
    ): Promise<T> {
        try {
            const response = await requestFn({ key: config.GOOGLE_MAPS_API_KEY });
            return response.data;
        } catch (error) {
            throw new GoogleMapsError(
                error instanceof Error ? error.message : String(error)
            );
        }
    }
    
    async geocode(address: string): Promise<LatLng> {
        const data = await this.handleRequest<any>((params) =>
            this.client.geocode({ params: { ...params, address } })
    );
    
    if (data.results.length === 0) {
        throw new GoogleMapsError("No geocode results found.");
    }
    return data.results[0].geometry.location;
}

async findPlacesNearby(
    latLng: LatLng,
    search: string,
    radius: number = config.DEFAULT_RADIUS
): Promise<PlacesNearbyResult[]> {
    const data = await this.handleRequest<any>((params) =>
        this.client.placesNearby({
        params: { ...params, location: latLng, radius, keyword: search },
    })
);
return data.results;
}

async getPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
    return await this.handleRequest<PlaceDetailsResult>((params) =>
        this.client.placeDetails({ params: { ...params, place_id: placeId } })
);
}
}

// Utility class for file operations and updates
class FileUtils {
    static calculateHash(content: string): string {
        return createHash("sha256").update(content).digest("hex");
    }
    
    static async checkForUpdates(): Promise<void> {
        if (config.DEV) return;
        
        try {
            const response = await fetch(config.UPDATE_URL);
            if (!response.ok) {
                throw new UpdateError(`Failed to fetch update: ${response.statusText}`);
            }
            
            const remoteContent = await response.text();
            const remoteHash = this.calculateHash(remoteContent);
            const localContent = readFileSync(__filename, "utf-8");
            const localHash = this.calculateHash(localContent);
            
            if (remoteHash !== localHash) {
                writeFileSync(__filename, remoteContent);
                console.log("Script updated. Restarting...");
                spawnSync("node", [__filename, ...process.argv.slice(2)], {
                    stdio: "inherit",
                });
                process.exit(0);
            }
        } catch (error) {
            throw new UpdateError(
                error instanceof Error ? error.message : String(error)
            );
        }
    }
    
    static outputResults(results: PlaceDetailsResult[]): void {
        try {
            writeFileSync("results.json", JSON.stringify(results, null, 2));
            console.log("Results saved to results.json");
        } catch (error) {
            throw new FileError(
                error instanceof Error ? error.message : String(error)
            );
        }
    }
}

// Interface for defining how a place should be scored
interface PlaceScoreCalculator {
    calculate(place: PlaceDetailsResult): number;
}

// Concrete implementation of the scoring algorithm
class DefaultPlaceScoreCalculator implements PlaceScoreCalculator {
    calculate(place: PlaceDetailsResult): number {
        const scoreFactors: Record<string, (p: PlaceDetailsResult) => number> = {
            photos: (p) => p.photos?.length || 0,
            rating: (p) => (p.rating ? Math.sqrt(p.rating) : 0),
            openNow: (p) => (p.opening_hours?.open_now ? 1 : 0),
            vicinity: (p) => (p.vicinity ? 1 : 0),
            userRatings: (p) =>
                p.user_ratings_total ? Math.log10(p.user_ratings_total) : 0,
            addressComponents: (p) =>
                p.address_components?.length
            ? Math.log10(p.address_components.length)
            : 0,
            reviews: (p) => p.reviews?.length || 0,
            openingHours: (p) =>
                p.current_opening_hours?.periods?.length ||
            p.opening_hours?.periods?.length
            ? 1
            : 0,
            contact: (p) => (p.formatted_phone_number ? 1 : 0),
            features: (p) => this.calculateFeatureScore(p),
            types: (p) => (p.types?.length ? Math.log10(p.types.length) : 0),
        };
        
        return Object.values(scoreFactors).reduce((score, factor) => {
            try {
                return score + factor(place);
            } catch (error) {
                console.warn(
                    `Error applying scoring factor to place ${place.place_id}: ${error}`
                );
                return score;
            }
        }, 0);
    }
    
    private calculateFeatureScore(place: PlaceDetailsResult): number {
        const features: (keyof PlaceDetailsResult)[] = [
            "reservable",
            "serves_beer",
            "serves_breakfast",
            "serves_brunch",
            "serves_dinner",
            "serves_lunch",
            "serves_vegetarian_food",
            "serves_wine",
            "takeout",
            "website",
        ];
        
        return features.reduce<number>((score, feature) => {
            // Explicitly check if the property exists and is truthy
            if (place[feature]) {
                return score + 1;
            } else {
                return score;
            }
        }, 0);
    }
}

// Main application class
class PlacesSearchApp {
    private mapsService: GoogleMapsService;
    private placeScorer: PlaceScoreCalculator;
    
    constructor(
        mapsService: GoogleMapsService,
        placeScorer: PlaceScoreCalculator
    ) {
        this.mapsService = mapsService;
        this.placeScorer = placeScorer;
    }
    
    async initialize(): Promise<void> {
        await FileUtils.checkForUpdates();
        // Initialize maps service if necessary (constructor is now synchronous)
        // await this.mapsService.initialize();
    }
    
    async run(): Promise<void> {
        try {
            await this.initialize();
            
            const searchQuery = this.getSearchQuery();
            const radius = this.getRadius();
            const centerAddress = this.getCenterAddress();
            const center = await this.mapsService.geocode(centerAddress);
            
            const places = await this.searchAndScorePlaces(
                searchQuery,
                center,
                radius
            );
            FileUtils.outputResults(places);
            
            console.log("Total places found:", places.length);
        } catch (error) {
            console.error("Error during execution:", error);
            process.exit(1);
        }
    }
    
    private getSearchQuery(): string {
        const searchQuery = process.argv[2];
        if (!searchQuery) {
            throw new Error("Please provide a search query.");
        }
        return searchQuery;
    }
    
    private getRadius(): number {
        return Number(process.env.RADIUS) || config.DEFAULT_RADIUS;
    }
    
    private getCenterAddress(): string {
        return process.env.CENTER_ADDRESS || config.DEFAULT_CENTER_ADDRESS;
    }
    
    async searchAndScorePlaces(
        query: string,
        center: LatLng,
        radius: number
    ): Promise<PlaceDetailsResult[]> {
        const placesNearby = await this.mapsService.findPlacesNearby(
            center,
            query,
            radius
        );
        const placesWithDetails = await Promise.all(
            placesNearby.map((place) =>
                this.mapsService.getPlaceDetails(place.place_id)
        )
    );
    
    return placesWithDetails
    .map((place) => ({
        ...place,
        _SCORE: this.placeScorer.calculate(place),
    }))
    .sort((a, b) => (b._SCORE || 0) - (a._SCORE || 0));
}
}

// Execute the application
(async () => {
    try {
        const mapsService = new GoogleMapsService();
        const placeScorer = new DefaultPlaceScoreCalculator();
        const app = new PlacesSearchApp(mapsService, placeScorer);
        await app.run();
    } catch (error) {
        console.error("Unexpected error:", error);
        process.exit(1);
    }
})();
