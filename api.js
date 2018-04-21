const rp = require('request-promise')

const api_settings = require('./api_settings')


exports.getDocumentsByKeyword = (session, keyword) => {
    doRequestAndSendResultDialog(session, 'keyword/like/' + keyword)
}

exports.sendPdfDisplay = (id) => {
    rp({
        method: 'POST',
        uri: api_settings.baseUrl + '/pdf/' + id,
    })
        .then((v) => 0)
        .catch((err) => console.error(err))
}


doRequestAndSendResultDialog = (session, apiPath) => {
    let apiPromise = rp({
        uri: api_settings.baseUrl + '/database/api/v1.0/documents/',
        json: true
    })

    Promise.all([session, apiPromise])
        .then((values) => {
            let session = values[0]
            let jsonData = values[1]

            session.replaceDialog('InternalResultsDialog', jsonData)
        })
        .catch((err) => {
            console.error(err)
        })
}
