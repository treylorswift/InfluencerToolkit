import * as crypto from 'crypto'
import * as fs from 'fs'

//there is an issue with typescript not realizing that 'Twitter' here is a class,
//so there are some @ts-ignore lines in here to suppress the incorrect warnings
import * as Twitter from 'twitter-lite';

import {TwitterFollower} from './TwitterUser'
import {TwitterUser} from './TwitterUser'
import {DelaySeconds} from './Delay'

export class MessagingCampaign
{
    message:string
    campaign_id:string
    sort:"influence"|"recent"
    count?:number
    filter?:
    {
        tags?:Array<string>
    }

    static fromJSON(json:any):MessagingCampaign
    {
        var campaign = new MessagingCampaign();

        //must have valid message content
        if (!json.message)
        {
            console.log("MessagingCampaign - No message specified, can't continue");
            return null;
        }
        else
        if (typeof(json.message)!=='string')
        {
            console.log("MessagingCampaign - Invalid message specified: " + JSON.stringify(json.message));
            return null;
        }
        campaign.message = json.message;

        //if no campaign_id specified, generate it from the hash of the
        //message content
        campaign.campaign_id = json.campaign_id;
        if (!campaign.campaign_id)
            campaign.campaign_id = crypto.createHash("sha256").update(campaign.message).digest("hex");
        else
        if (typeof(campaign.campaign_id)==='number')
            campaign.campaign_id = (campaign.campaign_id as number).toString();
        else
        if (typeof(campaign.campaign_id)!=='string')
        {
            //any other kind of campaign id in the json is invalid
            console.log("MessagingCampaign - Invalid campaign_id specified: " + JSON.stringify(campaign.campaign_id));
            return null;
        }

        //make sure count, if specified, is a number
        campaign.count = json.count;
        if (campaign.count && typeof(campaign.count)!=='number')
        {
            console.log("MessagingCampaign - Invalid count specified: " + JSON.stringify(campaign.count));
            return null;
        }

        //make sure sort, if specified, is a string and is either 'influence' or 'recent'
        campaign.sort = json.sort;
        if (!campaign.sort)
            campaign.sort = "influence";
        else
        if (typeof(campaign.sort)!=='string' ||
            (campaign.sort!=='influence' && campaign.sort!=='recent'))
        {
            console.log("MessagingCampaign - Invalid sort specified: " + JSON.stringify(campaign.sort));
            return null;
        }

        //make sure filter, if specified, is an object
        campaign.filter = json.filter;
        if (campaign.filter && typeof(campaign.filter)!=='object')
        {
            console.log("MessagingCampaign - Invalid filter specified: " + JSON.stringify(campaign.filter));
            return null;
        }

        if (campaign.filter)
        {
            //make sure if filter tags are specified, they are an array
            campaign.filter.tags = json.filter.tags;
            if (campaign.filter.tags && !Array.isArray(campaign.filter.tags))
            {
                console.log("MessagingCampaign - Invalid filter tags specified: " + JSON.stringify(campaign.filter.tags));
                return null;
            }

            if (campaign.filter.tags)
            {
                //make sure each tag is a string. numbers are ok, but are converted to string
                for (var i=0; i<campaign.filter.tags.length; i++)
                {
                    var tag = campaign.filter.tags[i];
                    if (typeof(tag)!=='string')
                    {
                        if (typeof(tag)==='number')
                            campaign.filter.tags[i] = (tag as number).toString();
                        else
                        {
                            console.log("MessagingCampaign - Invalid filter tag specified: " + JSON.stringify(tag));
                            return null;
                        }
                    }
                }
            }
        }

        //whew. campaign is valid

        return campaign;
    }
}

function LoadMessageHistory(screen_name:string):MessageHistory
{
    try
    {
        var json = JSON.parse(fs.readFileSync(`./${screen_name}.messageHistory.json`,'utf-8'));

        var msgHistory = new MessageHistory();

        //extract the message events
        for (var i=0; i<json.events.length; i++)
        {
            let event = json.events[i] as MessageEventJson;
            msgHistory.events.push({campaign_id:event.campaign_id,recipient:event.recipient, time:new Date(event.time)});
        }

        //extract the campaign / recipient / date maps
        var campaignKeys = Object.keys(json.campaigns);
        for (var i=0; i<campaignKeys.length; i++)
        {
            var recipientMap = json.campaigns[campaignKeys[i]];
            var recipientKeys = Object.keys(recipientMap);

            var newRecipientMap = new Map<string,Date>();
            for (var j=0; j<recipientKeys.length; j++)
            {
                newRecipientMap.set(recipientKeys[j], new Date(recipientMap[recipientKeys[j]]));
            }

            msgHistory.campaigns.set(campaignKeys[i],newRecipientMap);
        }

        return msgHistory;
    }
    catch (err)
    {
        if (err.code!=="ENOENT")
        {
            console.log("LoadMessageHistory unexpected error: ");
            console.error(err);
            process.exit(-1);
        }
    }

    return new MessageHistory();
}

function SaveMessageHistory(screen_name:string, msgHistory:MessageHistory)
{
    //the events array can convert to json without any special handling
    var json:any = {};
    json.events = msgHistory.events;

    //the campaign maps are trickier and can't be written directly, must
    //be converted from Map<>s to basic json maps

    //the campaign map needs to end up looking like this:
    //"campaign_id":
    //{
    //  "recipient_id":<date they were sent this campaign message>
    //}
    //must convert the Map of strings to json maps before writing
    json.campaigns = {};

    msgHistory.campaigns.forEach((value:RecipientMap,campaign_id:string,map:CampaignMap):void =>
    {
        json.campaigns[campaign_id] = {};

        msgHistory.campaigns.get(campaign_id).forEach((date:Date,recipient_id:string,map:RecipientMap):void =>
        {
            json.campaigns[campaign_id][recipient_id] = date.toISOString();
        });
    });

    fs.writeFileSync(`./${screen_name}.messageHistory.json`,JSON.stringify(json,null,2));
}

export class MessagingCampaignManager
{
    private user:TwitterUser;

    //@ts-ignore
    private twitter:Twitter;

    private campaign:MessagingCampaign;
    private recipients:Array<TwitterFollower>;

    private nextRecipientIndex:number;
    private totalSent:number;
    private totalToSend:number;
    private messageHistory:MessageHistory;
    
    //@ts-ignore
    constructor(user:TwitterUser, campaign:MessagingCampaign)
    {
        this.user = user;
        this.twitter = user.GetTwitterClient();
        this.campaign = campaign;
        this.recipients = null;

        this.nextRecipientIndex = 0;
        this.totalSent = 0;
        this.totalToSend = 0;

        this.messageHistory = LoadMessageHistory(this.user.GetScreenName());
    }


    private SendMessage = async (recipientId:string)=>
    {
        var curDate = new Date();

        //update the message history log with this event
        //the events are used to track how many of our 1000-messages-per-24-hours we've used up
        this.messageHistory.events.push({campaign_id:this.campaign.campaign_id, recipient:recipientId,time:curDate});

        //update the recipient map for this campaign so we remember that this recipient has
        //already received this campaign. we store the current date into the map, which
        //implicitly means that the follower was sent this campaign at that date/time

        //create the recipient map for this campaign if it doesnt exist yet
        var recipientMap = this.messageHistory.campaigns.get(this.campaign.campaign_id);
        if (!recipientMap)
        {
            recipientMap = new Map<string,Date>();
            this.messageHistory.campaigns.set(this.campaign.campaign_id, recipientMap);
        }

        let params = 
        {
            event:
            {
                type: 'message_create',
                message_create:
                {
                    target: { recipient_id: recipientId },
                    message_data: { text: this.campaign.message }
                }
            }
        }

        //set to false for testing
        let actuallySendMessage = false;

        //loop until we're actually able to send without any response error
        while (1)
        {
            try
            {
                if (actuallySendMessage)
                {
                    let response = await this.twitter.post('direct_messages/events/new', params);
                }

                //update the entry for this recipient. they received this campaign on 'curDate'
                recipientMap.set(recipientId, curDate);

                //save the history back to wherever its being stored    
                SaveMessageHistory(this.user.GetScreenName(), this.messageHistory);

                break;
            }
            catch (err)
            {
                //need to handle going over the rate limit..
                if (err && Array.isArray(err.errors) && err.errors[0] && err.errors[0].code===88)
                {
                    console.log('Unexpectedly hit api rate limit, waiting 1 minute before attempting again');
                }
                else
                {
                    console.log('Unexpected Twitter API response error, retrying in 1 minute:');
                    console.error(err);
                }
                await DelaySeconds(60);
            }
        }
    }

    private ProcessMessages = ()=>
    {
        //have we sent as many as we intended to?
        if (this.totalSent>=this.totalToSend)
        {
            console.log(`MessagingCampaign complete, sent ${this.totalSent} messages`);
            return;
        }

        //need to figure out who the next recipeint is
        //1) need to stop if there are no more eligible recipients
        //2) need to skip recipients who have already been contacted in this campaign
        while (this.nextRecipientIndex<this.recipients.length &&
               this.messageHistory.HasRecipientRecievedCampaign(this.recipients[this.nextRecipientIndex].id_str, this.campaign.campaign_id))
        {
            this.nextRecipientIndex++;
        }

        let recipientIndex = this.nextRecipientIndex;

        if (recipientIndex>=this.recipients.length)
        {
            console.log(`MessagingCampaign complete, no more eligible followers to message, sent ${this.totalSent} of ${this.totalToSend} messages`);
            return;
        }

        //figure out when it is safe to start sending the next message
        //max of 1000 can be sent in 24 hour window
        var timeToWait = this.messageHistory.CalcMillisToWaitUntilNextSend();
        if (timeToWait>0)
        {
            var curDate = new Date();
            var sendDate = new Date(curDate.getTime() + timeToWait);
            console.log(`Hit Twitter Direct Message API Rate Limit at ${curDate.toString()}`);
            console.log(`                     sending next message at ${sendDate.toString()}`);
        }


        setTimeout(()=>
        {
            console.log(`Sending ${this.totalSent+1} of ${this.totalToSend} - ${this.recipients[recipientIndex].screen_name}`);
            this.SendMessage(this.recipients[recipientIndex].id_str);
 
            //on to the next recipient, keep on going
            this.totalSent++;
            this.nextRecipientIndex++;
            setTimeout(this.ProcessMessages, 0);
        }, timeToWait);
    }

    async Run()
    {
        console.log("Beginning campaign: " + this.campaign.campaign_id);
        console.log("Campaign message: " + this.campaign.message);

        //get the users followers and sort them into an array that we'll
        //use for the work we're doing
        console.log(`Obtaining followers for ${this.user.GetScreenName()}..`);
        this.recipients = await this.user.GetFollowers();

        //apply any filter tags
        if (this.campaign.filter && this.campaign.filter.tags && this.campaign.filter.tags.length>0)
        {
            let filteredRecipients = new Array<TwitterFollower>();

            let keepTags = this.campaign.filter.tags;

            console.log("Applying filter, only sending to followers matching the following tags: " + keepTags.join(' '));

            //process all tags in lowercase
            for (var k=0; k<keepTags.length; k++)
            {
                keepTags[k] = keepTags[k].toLowerCase();
            }

            //iterate over all recipients, remove those that dont match any of the tags
            for (var i=0; i<this.recipients.length; i++)
            {
                let matched = false;

                //look at each tag in the recipients bio
                let userTags = this.recipients[i].bio_tags;
                for (var j=0; j<userTags.length; j++)
                {
                    //does it match any of the tags we're keeping?
                    for (var k=0; k<keepTags.length; k++)
                    {
                        if (userTags[j].toLowerCase()===keepTags[k])
                        {
                            //matched a tag, move this user to the filtered list
                            filteredRecipients.push(this.recipients[i]);
                            matched = true;
                            break;
                        }
                    }
                    //dont need to keep looking at users tags if we already matched
                    if (matched)
                        break;
                }
            }

            //proceed only with the filtered recipients
            this.recipients = filteredRecipients;
            console.log(`${this.recipients.length} followers contained matching tags`);
        }

        //as cached, the followers are ordered by most recently followed (according to api docs)
        //so we only need to sort if 'influence' is specified
        if (this.campaign.sort==='influence')
        {
            console.log('Sorting followers by influence');
            function influenceSort(a:TwitterFollower,b:TwitterFollower)
            {
                if (a.followers_count>b.followers_count)
                    return -1;
                if (a.followers_count<b.followers_count)
                    return 1;
                return 0;
            }

            this.recipients.sort(influenceSort);
        }
        else
        {
            console.log('Sorting followers by most-recently-followed');
        }

        //by default we will attempt to send to every follower
        this.totalSent = 0;
        this.totalToSend = this.recipients.length;

        //if the campaign defines a limit, we stay within that limit
        if (this.campaign.count)
            this.totalToSend = this.campaign.count;
        
        console.log(`Preparing to contact ${this.totalToSend} followers`);

        this.ProcessMessages();
    }
}

type MessageEvent = {campaign_id:string,recipient:string, time:Date};
type MessageEventJson = {campaign_id:string,recipient:string, time:string};
type RecipientMap = Map<string,Date>;
type CampaignMap = Map<string,RecipientMap>;

export class MessageHistory
{
    events:Array<MessageEvent> = new Array<MessageEvent>();
    campaigns:CampaignMap = new Map<string,RecipientMap>();

    //based on history and twitter rate limit of
    //1000 messages per user per day,
    //determine how many milliseconds we must wait until
    //sending the next message
    CalcMillisToWaitUntilNextSend():number
    {
        //if we havent yet sent *more* than 1000 messages in total, we can send immediately
        if (this.events.length<=1000)
            return 0;
        
        //look back 1000 messages into the past. when did we send that one?
        //was it more than 24 hours ago? if so, we can send immediately
        let event = this.events[1000];

        let millisIn24Hours = 1000*60*60*24;
        var curTime = new Date();
        var twentyTwentyTwentyFourHoursAgooo = new Date(curTime.getTime() - millisIn24Hours);

        //if the 1000th message in the past is older than a day, we can send now.
        if (event.time.getTime() < twentyTwentyTwentyFourHoursAgooo.getTime())
            return 0;

        //ok so the 1000th message is within the past 24 hours. the time at which
        //we will be able to send is 24 hours after that message.
        let timeToSend = new Date(event.time.getTime() + millisIn24Hours);

        //the amount of time to wait is just subtraction
        let timeToWait = timeToSend.getTime() - curTime.getTime();
        if (timeToWait<0)
        {
            console.log("check your math bro");
            timeToWait = 0;
        }

        return timeToWait;
    }

    HasRecipientRecievedCampaign(id_str:string, campaign_id:string):boolean
    {
        //the campaign map stores, for each recipient, what time they were sent the message
        //it could also store other things like.. the unique conversion link they were sent..
        //whether they have clicked that conversion link yet.. etc

        //get the map which contains info about the recipients who have been
        //contacted by this campaign
        var recipientMap = this.campaigns.get(campaign_id);

        //if none have been contacted yet, then obviously this recipient hasnt
        //been contacted yet
        if (!recipientMap)
            return false;

        var date = recipientMap.get(id_str);
        if (date) return true;
        return false;
    }
}
