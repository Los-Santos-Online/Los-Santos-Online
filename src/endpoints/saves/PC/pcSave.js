import {prisma, generateError, sendLogMessage, s3Client} from "../../../main.js";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";


// Save for PC
export async function saveSaveFilePC(req, res) {
    try {
      const user = await prisma.user.findFirstOrThrow({
        where: {
          SessionTicket: req.headers["ros-sessionticket"],
        },
      });
  
      if (!user) return;
  
      //await sendLogMessage(`Saving Save File for: ${user.name} on PC`);
  
      const file = req.body[0];
      const filename = file.headers["content-disposition"].filename;
      const fileBuffer = file.body;
      const s3Key = `pc/saveFiles/${req.params.scId}/${filename}`;
      
      // Upload to S3
      const putCommand = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: "application/octet-stream"
      });
      
      await s3Client.send(putCommand);
      
      res.status(200).send('<?xml version="1.0" encoding="utf-8"?> <Response ms="0"> <Status>1<Status> </Response>');
    } catch (error) {
      console.log(error);
      res.status(500).send('<?xml version="1.0" encoding="utf-8"?> <Response ms="0"> <Status>0<Status> </Response>');
    }
}


  //GET THE SAVE FILE PC
export async function getSaveFilePC(req, res) {
    try {
      const user = await prisma.user.findFirstOrThrow({
        where: {
          SessionTicket: req.headers["ros-sessionticket"],
        },
      });
  
      if (!user) return;
  
      const scId = req.params.scId;
      const saveFileName = req.params.saveFileName;
      const s3Key = `pc/saveFiles/${scId}/${saveFileName}`;

      const { Body } = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: s3Key,
        })
      );

      // Read the entire stream into a buffer
      const chunks = [];
      for await (const chunk of Body) {
        chunks.push(chunk);
      }
      const fileContent = Buffer.concat(chunks);
      
      
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Cache-Control", "private, max-age=0");
      res.send(fileContent); // Send the complete (and potentially encrypted) content
    } catch (err) {
      console.log(err);
      res.setHeader("Content-Type", "application/octet-stream");
      res.status(404).send(generateError(0, "DoesNotExist", ""));
    }
  }  
