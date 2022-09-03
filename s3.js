require("dotenv").config();
const fs = require("fs");
const S3 = require("aws-sdk/clients/s3");

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_ACCESS_SECRET_KEY;

const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey,
});

function uploadFile(card) {
    const fileStreamBackground = fs.createReadStream(card.background[0].path);
    const fileStreamSubject = fs.createReadStream(card.subject[0].path);

    const uploadBackgroundParams = {
        Bucket: bucketName,
        Body: fileStreamBackground,
        Key: card.background[0].filename,
        ACL:'public-read'
    };

    const uploadSubjectParams = {
        Bucket: bucketName,
        Body: fileStreamSubject,
        Key: card.subject[0].filename,
        ACL:'public-read'
    };

    const res = Promise.all([
        s3.upload(uploadBackgroundParams).promise(),
        s3.upload(uploadSubjectParams).promise(),
    ])
        .then((res) => {
            return res;
        })
        .catch((err) => {
            return err;
        });

    return res;
}

exports.uploadFile = uploadFile;