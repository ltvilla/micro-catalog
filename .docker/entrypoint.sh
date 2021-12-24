#!/bin/bash

npm config set cache /home/node/app/.npm-cache --global

# shellcheck disable=SC2164
cd /home/node/app

npm install

nodemon -L