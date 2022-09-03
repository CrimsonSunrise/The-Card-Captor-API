#!/bin/bash

#give permission for everything in the express-app directory
sudo chmod -R 777 /home/ec2-user/express-app

#navigate into our working directory where we have all our github files
cd /home/ec2-user/express-app
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
cp ../.env ./.env
nvm install --lts
npm install pm2 -g

#install node modules
npm install

#start our node app in the background

pm2 stop index.js
pm2 delete index.js
pm2 start index.js