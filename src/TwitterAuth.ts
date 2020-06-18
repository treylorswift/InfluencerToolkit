import * as fs from 'fs';

export type AppAuth = {consumer_key:string, consumer_secret:string};
export type UserAuth = {access_token_key:string, access_token_secret:string};

//make sure the app auth that came from storage contains the appropriate keys and that they are at least non-empty strings
function TypeCheckAppAuth(app_auth:AppAuth):boolean
{
    if (!app_auth.consumer_key || !app_auth.consumer_secret ||
        typeof(app_auth.consumer_key)!=='string' ||
        typeof(app_auth.consumer_secret)!=='string')
    {
        return false;
    }

    return true;
}

//will silently return null if unable to open and successfully type-check app auth key file
export function TryLoadAppAuth(fileName:string):AppAuth
{
    let app_auth;
    try
    {
        app_auth = JSON.parse(fs.readFileSync(fileName,'utf-8'));
    }
    catch (err)
    {
        return null;
    }

    if (TypeCheckAppAuth(app_auth))
        return app_auth;

    return null;
}

//will loudly report errors if unable to open or successfully type-check app auth key file, AND process.exit(-1)
export function LoadAppAuth(fileName:string):AppAuth
{
    let app_auth;
    try
    {
        app_auth = JSON.parse(fs.readFileSync(fileName,'utf-8'));
    }
    catch (err)
    {
        console.log(`Error reading ${fileName}:`);
        console.error(err);
        process.exit(-1);
    }

    if (TypeCheckAppAuth(app_auth))
        return app_auth;

    console.log(`${fileName} has invalid or missing consumer_key and/or consumer_secret: ${JSON.stringify(app_auth)}`);
    process.exit(-1);
}

//make sure the app auth that came from storage contains the appropriate keys and that they are at least non-empty strings
function TypeCheckUserAuth(user_auth:UserAuth):boolean
{
    if (!user_auth.access_token_key || !user_auth.access_token_secret ||
        typeof(user_auth.access_token_key)!=='string' ||
        typeof(user_auth.access_token_secret)!=='string')
    {
        return false;
    }

    return true;
}

//will silently return null if unable to open and successfully type-check user auth key file
export function TryLoadUserAuth(fileName:string):UserAuth
{
    let user_auth;
    try
    {
        user_auth = JSON.parse(fs.readFileSync(fileName,'utf-8'));
    }
    catch (err)
    {
        return null;
    }

    if (TypeCheckUserAuth(user_auth))
        return user_auth;

    return null;
}

//will loudly report errors if unable to open or successfully type-check app auth key file, AND process.exit(-1)
export function LoadUserAuth(fileName:string):UserAuth
{
    let user_auth;
    try
    {
        user_auth = JSON.parse(fs.readFileSync(fileName,'utf-8'));
    }
    catch (err)
    {
        console.log(`Error reading ${fileName}:`);
        console.error(err);
        process.exit(-1);
    }

    if (TypeCheckUserAuth(user_auth))
        return user_auth;

    console.log(`${fileName} has invalid or missing access_token_key and/or access_token_secret: ${JSON.stringify(user_auth)}`);
    process.exit(-1);
}
