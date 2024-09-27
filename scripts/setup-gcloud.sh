echo ""
echo "Vc é o cara"
echo "Instalando o GCP CLI para o cara, aguarde..."
echo ""
mkdir -p ~/.local/share
mkdir -p ~/.local/bin
cd ~/.local/share
curl -s -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz
tar -xf google-cloud-cli-linux-x86_64.tar.gz
./google-cloud-sdk/install.sh
./google-cloud-sdk/bin/gcloud init
ln -s ~/.local/share/google-cloud-sdk/bin/gcloud ~/.local/bin/gcloud        
source ~/.bashrc