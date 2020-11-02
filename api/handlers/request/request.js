const axios = require('axios');

exports.handler = async body => {
    try {
        if ((body.event.value === 'REQUEST_CREATED') && (body.user_request.request_status === 'NOT_STARTED') && (body.user_request.request_type === 'DIGITIZATION') && (body.user_request.request_sub_type.value === 'PHYSICAL_TO_DIGITIZATION')) {
            const request = body.user_request;
            const item = await getItem(request.mms_id)
            if (item) {
                const location = item.holding_data.temp_location.value;
                const user = await getUser(request.user_primary_id);
                const {
                    auEmail,
                    email
                } = selectEmail(user.contact_info.email);
                const sharepointEntry = {
                    title: request.title,
                    mms: request.mms_id,
                    barcode: item.item_data.barcode,
                    patron: request.user_primary_id,
                    request: request.request_id,
                    key: process.env.AUTOMATE_KEY,
                    email: email,
                    au_email: auEmail,
                    available: false,
                    location: location,
                    status: 'New Request',
                    scanned: location === 'auzs' ? true : false,
                    call_no: item.holding_data.call_number
                };
                await addSharepointItems(sharepointEntry);
                // const cancelRes = await cancelRequest(request.request_id, request.user_primary_id);
            }
        }
    } catch (error) {
        console.error('webhook error', error);
    }
}

const getItem = mmsId => {
    return new Promise(async (resolve, reject) => {
        try {
            const itemUrl = 'https://api-na.hosted.exlibrisgroup.com/almaws/v1/bibs/{mms_id}/holdings/ALL/items'
                .replace(/{mms_id}/g, encodeURIComponent(mmsId));
            const res = await axios.get(itemUrl, {
                params: {
                    format: 'json',
                    apikey: process.env.BIBS_API_KEY
                }
            });
            let retItem = null;
            for (let i = 0; i < res.data.item.length; i++) {
                const item = res.data.item[i];
                const holding = item.holding_data;
                if (holding.in_temp_location && (holding.temp_location.value === 'auz' || holding.temp_location.value === 'auzs')) {
                    retItem = item;
                    break;
                }
            }
            resolve(retItem);
        } catch (error) {
            console.log(error)
            if (error.response) {
                const responseMessage = error.response.data.errorList.error.map(error => error.errorMessage).join();
                reject(responseMessage);
            } else if (error.request) {
                reject(error.request);
            } else {
                reject(error.message);
            }
        }
    });
};

const addSharepointItems = body => {
    return new Promise(async (resolve, reject) => {
        try {
            const sharepointUrl = process.env.AUTOMATE_URL;
            const sharepointRes = axios({
                method: 'post',
                url: sharepointUrl,
                data: body
            });
            resolve(sharepointRes);
        } catch (err) {
            reject(err)
        }
    });
}

const getUser = userId => {
    return new Promise(async (resolve, reject) => {

        try {
            const userUrl = 'https://api-na.hosted.exlibrisgroup.com/almaws/v1/users/{user_id}'
                .replace(/{user_id}/g, encodeURIComponent(userId));
            const userRes = await axios.get(userUrl, {
                params: {
                    format: 'json',
                    apikey: process.env.USERS_API_KEY
                }
            });
            resolve(userRes.data);
        } catch (error) {
            if (error.response) {
                const responseMessage = error.response.data.errorList.error.map(error => error.errorMessage).join();
                reject(responseMessage);
            } else if (error.request) {
                reject(error.request);
            } else {
                reject(error.message);
            }
        }
    });
};

const selectEmail = emailArray => {
    let email, auEmail;
    const preferredEmail = emailArray.filter(email => email.preferred === true).map(email => email.email_address);
    email = preferredEmail.length > 0 ? preferredEmail[0] : null;
    auEmail = preferredEmail.length > 0 ? preferredEmail[0] : null;
    if (!email || email.slice(-12) !== 'american.edu') {
        const auEmailArray = emailArray.filter(email => email.email_address.slice(-12) === 'american.edu').map(email => email.email_address);
        email = auEmailArray.length > 0 ? auEmailArray[0] : email ? email : emailArray[0].email_address;
        auEmail = auEmailArray.length > 0 ? auEmailArray[0] : 'circulation@american.edu';
    }
    email = email.replace('student.american.edu', 'american.edu');
    auEmail = auEmail.replace('student.american.edu', 'american.edu');
    return {
        auEmail: email,
        email: email
    };
}

const cancelRequest = (requestId, userId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const deleteUrl = 'https://api-na.hosted.exlibrisgroup.com/almaws/v1/users/{user_id}/requests/{request_id}'
                .replace(/{user_id}/g, encodeURIComponent(userId))
                .replace(/{request_id}/g, encodeURIComponent(requestId));
            const deleteRes = axios({
                method: 'delete',
                url: deleteUrl,
                params: {
                    format: 'json',
                    apikey: process.env.USERS_API_KEY,
                    reason: 'RequestSwitched',
                    note: 'CDL Cancel',
                    notify_user: false
                },
                data: {
                    circ_desk: 'DEFAULT_CIRC_DESK',
                    library: 'UNIV_LIB'
                }
            });
            resolve(deleteRes);
        } catch (err) {
            reject(err);
        }

    })
}