export async function DelaySeconds(secs:number):Promise<void>
{
    return new Promise<void>((resolve,reject)=>
    {
        let oneMinuteMillis = 1000*secs;

        setTimeout(()=>
        {
            return resolve();
        },oneMinuteMillis);
    });
}