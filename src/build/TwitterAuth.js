"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
function LoadAppAuth(fileName) {
    try {
        let app_auth = JSON.parse(fs.readFileSync(fileName, 'utf-8'));
        if (!app_auth.consumer_key || !app_auth.consumer_secret ||
            typeof (app_auth.consumer_key) !== 'string' ||
            typeof (app_auth.consumer_secret) !== 'string') {
            console.log(`${fileName} has invalid or missing consumer_key and/or consumer_secret`);
            process.exit(-1);
        }
        return app_auth;
    }
    catch (err) {
        console.log(`Error reading ${fileName}:`);
        console.error(err);
        process.exit(-1);
    }
}
exports.LoadAppAuth = LoadAppAuth;
function LoadUserAuth(fileName) {
    try {
        let user_auth = JSON.parse(fs.readFileSync(fileName, 'utf-8'));
        if (!user_auth.access_token_key || !user_auth.access_token_secret ||
            typeof (user_auth.access_token_key) !== 'string' ||
            typeof (user_auth.access_token_secret) !== 'string') {
            console.log("user_auth.json missing or invalid access_token_key and/or access_token_secret");
            process.exit(-1);
        }
        return user_auth;
    }
    catch (err) {
        console.log("Error reading user_auth.json:");
        console.error(err);
        process.exit(-1);
    }
}
exports.LoadUserAuth = LoadUserAuth;