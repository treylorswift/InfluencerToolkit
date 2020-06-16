# Influencer Toolkit

Influencer Toolkit automates sending of direct messages to your Twitter followers.

### Features

- Node.js command-line tool runs messaging campaigns defined in simple .json files (see "Create your messaging campaign" further below)

- Followers are downloaded and cached on the first run. @balajis your follower download will take around 30-40 minutes. If the follower download is interrupted it will resume where it left off on the next run. Refresh your follower cache at any time by running with the `-rebuildFollowers` command-line option.

- Followers are automatically sorted by influence and can be further filtered by tags (ie matching words in their twitter bio). You can also sort them by most-recently-followed.

- Message sends are tracked to ensure each follower is contacted only once, and scheduled to avoid hitting API rate limit errors. If rate limit errors are hit, it will wait 1 minute and retry. Tracking is stored on disk so it will do the right thing across invocations.
 
- Dry runs allow you to see who would be contacted by a messaging campaign without actually spamming people.

### 


### Usage

1.  `git clone https://github.com/treylorswift/InfluencerToolkit.git`
2.  navigate to src/
3.  `npm install`
4.  Go to <https://apps.twitter.com> and create an app for testing. Make sure it has read/write permissions.
5.  Grab the consumer key/secret, and the access token/secret and put them in src/build/app_auth.json and src/build/user_auth.json, respectively.
6. navigate to src/build
7. Run the test campaign (described below)

```
The test campaign won't actually send messages unless you edit testCampaign.json and remove "dryRun":true.
This is to prevent people from unintentionally spamming their followers during testing.

It is configured to send a short message to your 10 most influential followers who have 'love'
mentioned in their Twitter bio.

Your follower list will be downloaded the first time you run. Due to API rate limiting this could
take quite awhile if you have a lot of follwers (roughly 1 hour for 300k followers). 

Example output below:

>node itk.js testCampaign.json

Messaging campaign JSON parsed from testCampaign.json successfully
Beginning campaign: test001
Campaign message: Make sure the important people in your life know that you love them. Tell them today.
Obtaining followers for treylorswift..
Retreiving 644 followers for treylorswift..
Finished retreiving followers for treylorswift, total received: 644 - total expected: 644
Applying filter, only sending to followers matching the following tags: love
9 followers contained matching tags
Sorting followers by influence
Preparing to contact 9 followers
*** Campaign.DryRun===true, progress will be displayed but messages will not actually be sent or logged ***
Sending 1 of 9 - harddrop
Sending 2 of 9 - yoshipro101
Sending 3 of 9 - bbool_
Sending 4 of 9 - Mabry00Mr
Sending 5 of 9 - TheEasyBaker
Sending 6 of 9 - ROBDAWGG619
Sending 7 of 9 - wordyBirdyNerdy
Sending 8 of 9 - ratcool_shooter
Sending 9 of 9 - JaydenGittel
MessagingCampaign complete, sent 9 messages
```
## Development

The repo ships with pre-built .js files in src/build so that you can run/test without
having to install Typescript. But you will obviously need Typescript if you want to
work with the .ts files in src/ .

## Credits

- Written by [@treylorswift](https://twitter.com/treylorswift)

- Uses https://github.com/draftbit/twitter-lite/ for Twitter API access


## Command-line information

Run with no command line arguments to get more info on usage:

```
>node itk.js

itk ("Influencer Toolkit") automates sending of direct messages to your Twitter followers.

Usage:

  node itk.js messaging_campaign_filename.json

  node itk.js { messaging campaign json specified directly on command line }

  node itk.js -rebuildFollowers <optional username>

app_auth.json must be present in the working directory and contain Twitter
app authorization keys as follows:

{
    consumer_key:string,
    consumer_secret:string
}

user_auth.json must be present in the working directory and contain Twitter
user authorization keys as follows:

{
    access_token_key:string,
    access_token_secret:string,
}

The first time you run itk, it will first retreive all of your followers
and their follower counts in order to rank them by influence. Api rate
limits mean this may take awhile if you have many followers (around 300k
followers per hour).

Your followers are cached and won't be retreived again unless you run with the
-rebuildFollowers option. If you abort the caching of followers, you can resume
by just re-running itk, but you should do so as quickly as possible since the
longer you wait the more likely circumstances could arise that make resuming not
possible (ie, the follower list itself changes substantially).

The messaging campaign json is as follows:

{
    message:string - message content - this is the only required field,
                     all other fields below are optional
                 
    count:number - limits sending to <number> followers. if not specified,
                   will send to all followers who have not already been
                   contacted for this campaign, subject to Twitters 1000 msg
                   per 24-hour-period limitations

    campaign_id:string - the identifier for this messaging campaign.
                         used to ensure each follower only receives
                         a single message for this campaign. if you
                         send to only a few followers at first, you can
                         change the message content for the campaign
                         for the remaining followers, and it will not
                         re-send to followers who have already been 
                         contacted in this campaign. if you don't specify
                         a campaign id, one will be generated by hashing
                         the message content.

    filter:
    {
        tags:Array<string> - only contacts followers whose Twitter bio contains words
                             that match any of the tags specified
    }

    sort:string - "influence" orders recipients by their follower count, "recent"
                  orders them by how recently they followed you. If not specified,
                  default is "influence".
                  
    dryRun:boolean - set to true to prevent messages from being sent or logged, useful
                     during testing
}
            
Examples:

btcCampaign.json:
  {
      "campaign_id": "btc001",
      "message": "Buy Bitcoin!",
      "sort": "influence",
      "filter": {
          "tags": [
              "bitcoin"
          ]
      },
      "count": 10
  }

  node itk.js btcCampaign.json

  This sends "Buy Bitcoin!" to the top 10 most influential people following you
  who mention bitcoin in their Twitter bio. Run the same command a second time
  to send the same message to the next 10 most influential people following you.

node itk.js -rebuildFollowers

  This will retreive all of your followers and save them to
  your_screen_name.followers.json, overwriting any previous cache saved there.
  If a previous follower cache operation was aborted in progress, it will attempt to
  resume.
