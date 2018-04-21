const restify = require('restify')
const builder = require('botbuilder')
const botbuilder_azure = require('botbuilder-azure')
const inMemoryStorage = new builder.MemoryBotStorage()

const utils = require('./utils')
const api = require('./api')


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
    if (hasMessageAttachment(session)) {
        session.replaceDialog('DocumentUploadDialog')
    } else {
        session.send(
            '\uD83E\uDD14'  /* thinking emoji */
            + ' I don\'t understand what you mean, sorry.\nPlease try rephrasing your question.'
        )
        console.log('[?] - ' + session.message.text)
        session.endConversation()
    }
})
bot.set('storage', inMemoryStorage)

const hasMessageAttachment = (session) => (
    session.message.attachments && session.message.attachments.length > 0
)

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
        if (hasMessageAttachment(session)) {
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

bot.dialog('ThanksDialog',
    (session) => {
        var responses = [
            'You\'re welcome.',
            'No problem!',
            'Nice. Can I help you with something else?'
        ]
        session.send(utils.choose(responses))
        session.endConversation()
    }
).triggerAction({
    matches: 'Thanks'
})

bot.dialog('DocumentUploadDialog',
    (session) => {
        if (hasMessageAttachment(session)) {
            session.send('Thank you for `%s`', session.message.attachments[0].contentUrl)
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

        api.getDocumentsByAuthor(session, session.dialogData.sender)
        session.endDialog()
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

        api.getDocumentsByKeyword(session, session.dialogData.keyword)
        session.endDialog()
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

        api.getDocumentsByDoctype(session, session.dialogData.type)
        session.endDialog()
    }
]).triggerAction({
    matches: 'Documents.Fetch.ByType'
})


//--- "INTERNAL" CALLBACKS FOR CARD BUTTONS
bot.dialog('InternalResultsDialog', [
    function (session, args, next) {
        if (args.length == 0) {
            session.send('\uD83D\uDE41 ' /* frowning emoji */ + 'Sorry, no results available.')
            session.endDialog()
        } else {
            let msg = new builder.Message(session)
            let attachments = []

            msg.attachmentLayout(builder.AttachmentLayout.carousel)

            for (var i = 0; i < args.length; i++) {
                let element = args[i]
                let linkElements = element.link.split('/')
                let title = linkElements[linkElements.length - 1]
                let date = element.date
                let pagesText = element.pages + ' page' + (element.pages > 1 ? 's' : '')
                let sender = element.author

                attachments.push(new builder.HeroCard(session)
                    .title(title)
                    .subtitle(
                        'added on ' + date +
                        '  \u25AA  ' + /* small black square */
                        pagesText
                    )
                    .text('sent by ' + sender)
                    .buttons([
                        builder.CardAction.postBack(session, 'DL ' + element.id, 'Download File'),
                        builder.CardAction.postBack(session, 'SUM ' + element.id, 'Show Summary')
                    ])
                )
            }

            msg.attachments(attachments)
            session.send(msg).endDialog()
        }
    }
])

bot.dialog('InternalDownloadDialog', [
    function (session, args, next) {
        let id = args.intent.matched[0].substr(3)
        session.send('Opening file in the display...')
        api.sendPdfDisplay(id)
        session.endConversation()
    }
]).triggerAction({ matches: /(DL)(\s|.)*/i })

bot.dialog('InternalSummaryForwardDialog', [
    function (session, args, next) {
        let id = args.intent.matched[0].substr(4)
        api.getAndSendSummary(session, id)
    }
]).triggerAction({ matches: /(SUM)(\s|.)*/i })

bot.dialog('InternalSummaryDialog', [
    function (session, text, next) {
        var msg = new builder.Message(session)
            .text('Here is the short version of it: *%s*', text)
            .textFormat('markdown')
        session.send(msg)
        session.endConversation()
    }
])
