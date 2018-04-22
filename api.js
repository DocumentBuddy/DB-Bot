const rp = require('request-promise')

const api_settings = require('./api_settings')


exports.getDocumentsByKeyword = (session, keyword) => {
    doRequestAndSendResultDialog(session, 'keyword/like/' + keyword)
}

exports.getDocumentsByDoctype = (session, doctype) => {
    doRequestAndSendResultDialog(session, 'doctype/like/' + doctype)
}

exports.getDocumentsByEntity = (session, entity) => {
    doRequestAndSendResultDialog(session, 'name_entity/like/' + entity)
}

exports.getDocumentsByPlace = (session, place) => {
    doRequestAndSendResultDialog(session, 'place/like/' + place)
}

doRequestAndSendResultDialog = (session, apiPath) => {
    let apiPromise = rp({
        uri: api_settings.baseUrl + '/database/api/v1.0/' + apiPath,
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


exports.sendPdfDisplay = (id) => {
    rp({
        method: 'POST',
        uri: api_settings.baseUrl + '/pdf/' + id,
    })
        .then((v) => 0)
        .catch((err) => console.error(err))
}

exports.getAndSendSummary = (session, id) => {
    rp({
        uri: api_settings.baseUrl + '/database/api/v1.0/summary/' + id,
        json: true
    })
        .then((jsonData) => session.replaceDialog('InternalSummaryDialog', jsonData.summary))
        .catch((err) => console.error(err))
}
