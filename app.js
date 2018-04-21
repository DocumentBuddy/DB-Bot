const restify = require('restify')
const builder = require('botbuilder')
const botbuilder_azure = require('botbuilder-azure')
const inMemoryStorage = new builder.MemoryBotStorage()

const utils = require('./utils')


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
    if (session.message.attachments) {
        session.replaceDialog('DocumentUploadDialog')
    } else {
        session.send(
            '\uD83E\uDD14'  /* thinking emoji */
            + ' I don\'t understand what you mean, sorry.\nPlease try rephrasing your question.'
        )
        session.endConversation()
    }
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
  .onEnabled(function (session, callback) {
    if (session.message.attachments) {
      // -> do not send to LUIS
      callback(null, false)
    } else {
      callback(null, true)
    }
})
bot.recognizer(recognizer)


//--- INTENT SPECIFIC DIALOG HANDLING
bot.dialog('HelpDialog',
    (session) => {
        session.send(
            'You can ask me whatever you need about your documents and I will surely help you.'
        )
        session.endConversation()
    }
).triggerAction({
    matches: 'Help'
})

bot.dialog('CancelDialog',
    (session) => {
        var responses = [
            'okay, aborted.',
            'All right, I will drop that.',
            'ok, see you later.',
            'ok, anything else I can do?',
            'okay, anything else?'
        ]
        session.send(utils.choose(responses))
        session.endConversation()
    }
).triggerAction({
    matches: 'Cancel'
})

bot.dialog('GreetingDialog',
    (session) => {
        var responses = [
            'Hey there! How may I help you?',
            'Hi, let\'s get started, shall we?',
            'Hey, what do you want to do?',
            'Hello. How may I assist you?',
            'Hi. What can I do for you?'
        ]
        session.send('\uD83D\uDC4B ' /* waving hand emoji */ + utils.choose(responses))
        session.endConversation()
    }
).triggerAction({
    matches: 'Greeting'
})

bot.dialog('DocumentUploadDialog',
    (session) => {
        let msg = session.message
        if (msg.attachments && msg.attachments.length > 0) {
            session.send('Thank you for `%s`', msg.attachments[0].contentUrl)
        } else {
            session.send(
                'You can drop me a file at any time with the attachment-button in the lower left corner.'
            )
        }
        session.endConversation()
    }
).triggerAction({
    matches: 'Document.Upload'
})

var documentSpecifiers = {
    'by Sender': {
        'handler': 'FetchDocumentBySenderDialog'
    },
    'by Keywords': {
        'handler': 'FetchDocumentByKeywordsDialog'
    },
    'by Type': {
        'handler': 'FetchDocumentByTypeDialog'
    }
}
bot.dialog('FetchDocumentsDialog', [
    function (session, args, next) {
        var responses = [
            'okay, lets get the documents.',
            'ok, I will fetch them for you.',
            'sure, I will get them right away.',
            'okay, lets fetch them quickly.',
            'ok, documents are coming right up.'
        ]
        session.send(utils.choose(responses))

        builder.Prompts.choice(session,
            'How do you want to specify the documents?', documentSpecifiers,
            { listStyle: builder.ListStyle.button }
        )
    },
    function (session, results) {
        var handlerDialog = documentSpecifiers[results.response.entity].handler
        session.replaceDialog(handlerDialog)
    }
]).triggerAction({
    matches: 'Documents.Fetch'
})

bot.dialog('FetchDocumentBySenderDialog', [
    function (session, args, next) {
        let senderFromIntnet = null
        if (args && args.intent) {
            senderFromIntnet = builder.EntityRecognizer.findEntity(args && args.intent.entities,
                'Document.Sender.Name'
            )
        }
        session.dialogData.sender = senderFromIntnet ? senderFromIntnet.entity : null

        if (!session.dialogData.sender) {
            builder.Prompts.text(session, 'From which Sender should I search documents?')
        } else {
            next()
        }
    },
    function (session, result) {
        if (result.response) {
            session.dialogData.sender = result.response
        }

        session.send('Found 17 documents from %s.', session.dialogData.sender)
        session.endConversation()
    }
]).triggerAction({
    matches: 'Documents.Fetch.BySender'
})

bot.dialog('FetchDocumentByKeywordsDialog', [
    function (session, args, next) {
        let keywordFromIntent = null
        if (args && args.intent) {
            keywordFromIntent = builder.EntityRecognizer.findEntity(args && args.intent.entities,
                'Document.Keyword'
            )
        }
        session.dialogData.keyword = keywordFromIntent ? keywordFromIntent.entity : null

        if (!session.dialogData.keyword) {
            builder.Prompts.text(session, 'For which Keywords should I search documents?')
        } else {
            next()
        }
    },
    function (session, result) {
        if (result.response) {
            session.dialogData.keyword = result.response
        }

        session.send('Found 17 documents about %s.', session.dialogData.keyword)
        session.endConversation()
    }
]).triggerAction({
    matches: 'Documents.Fetch.ByKeyword'
})

bot.dialog('FetchDocumentByTypeDialog', [
    function (session, args, next) {
        let typeFromIntent = null
        if (args && args.intent) {
            typeFromIntent = builder.EntityRecognizer.findEntity(args && args.intent.entities,
                'Document.Type'
            )
        }
        session.dialogData.type = typeFromIntent ? typeFromIntent.entity : null

        if (!session.dialogData.type) {
            builder.Prompts.text(session, 'Which document types should I search?')
        } else {
            next()
        }
    },
    function (session, result) {
        if (result.response) {
            session.dialogData.type = result.response
        }

        session.send('Found 17 %s documents.', session.dialogData.type)
        session.endConversation()
    }
]).triggerAction({
    matches: 'Documents.Fetch.ByType'
})
