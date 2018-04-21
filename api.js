const rp = require('request-promise')

exports.getDocumentsByKeyword = (session, keyword) => {
    doRequestAndSendResultDialog(session, 'keyword/like/' + keyword)
}


doRequestAndSendResultDialog = (session, apiPath) => {
    let baseUrl = process.env.apiBaseUrl || 'http://51.144.52.120:5000'
    let apiPromise = rp({
        'uri': baseUrl + '/database/api/v1.0/documents/',
        'json': true
    })

    Promise.all([session, apiPromise])
        .then(function (values) {
            let session = values[0]
            let jsonData = values[1]

            session.replaceDialog('InternalResultsDialog', jsonData)
        })
        .catch(function (err) {
            // Crawling failed...
        })
}
