import xml from "xml";
import { prisma, sendLogMessage } from "../../main.js";

function createMultiPostMessage() {
  return xml({ Response: [{ Status: 1 }] }, { declaration: true });
}

export const multiPostMessageHandler = async (req, res) => {
  try {
    const recipients = req.body.recipientsCsv
      .split(",")
      .map((recipient) => recipient.match(/"([^"]+)"/)?.[1])
      .filter(Boolean);

    for (const recipient of recipients) {
      await prisma.messages.create({
        data: {
          recipent: recipient,
          message: req.body.message,
        },
      });
    }

    res.set("Content-Type", "text/xml");
    res.send(createMultiPostMessage());
  } catch (error) {
    await sendLogMessage("ERROR IN MULTIPOST MESSAGE");
    console.error(error);
    res.sendStatus(500);
  }
};
