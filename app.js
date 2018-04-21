var restify = require('restify')
var builder = require('botbuilder')
var botbuilder_azure = require("botbuilder-azure")
var inMemoryStorage = new builder.MemoryBotStorage()


//--- START CONNECTIONS
var server = restify.createServer()
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s now listening to %s', server.name, server.url)
})

var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
})

server.post('/api/messages', connector.listen())


//--- INIT BOT
var bot = new builder.UniversalBot(connector, function (session, args) {
    // Default Handling: When nothing else matches
    session.send(
        '\uD83E\uDD14 I don\'t understand what you mean with \'%s\', sorry.', session.message.text
    )
})
bot.set('storage', inMemoryStorage)

// extract LUIS settings from environment variables
var luisAppId = process.env.LuisAppId
var luisAPIKey = process.env.LuisAPIKey
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com'
const LuisModelUrl =
    'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId
    + '?subscription-key=' + luisAPIKey

// add LUIS recognizer to the bot for reacting to intents
var recognizer = new builder.LuisRecognizer(LuisModelUrl)
bot.recognizer(recognizer)


//--- INTENT SPECIFIC DIALOG HANDLING
bot.dialog('HelpDialog',
    (session) => {
        session.send('Recognized as "Help" intent.', session.message.text)
        session.endDialog()
    }
).triggerAction({
    matches: 'Help'
})

bot.dialog('CancelDialog',
    (session) => {
        session.send('Recognized as "Cancel" intent.', session.message.text)
        session.endDialog()
    }
).triggerAction({
    matches: 'Cancel'
})

bot.dialog('FetchDocumentsDialog', [
    function (session, args, next) {
        let intent = args.intent
        let senderFromIntnet = builder.EntityRecognizer.findEntity(intent.entities,
            'Document.Sender.Name'
        )

        session.dialogData.sender = {}
        session.dialogData.sender.name = senderFromIntnet ? senderFromIntnet.entity : null

        session.send('Okay, lets get the documents.')
        if (!session.dialogData.sender.name) {
            builder.Prompts.text(session, "From which sender should I search documents?")
        } else {
            next()
        }
    },
    function (session, result) {
        if (result && result.response) {
            session.dialogData.sender.name = result.response
        }

        session.send('Found 17 documents from %s', session.dialogData.sender.name)
        session.endDialog()
    }
]).triggerAction({
    matches: 'Documents.Fetch'
})
