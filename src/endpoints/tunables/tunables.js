import { prisma } from "../../main.js";
import fs from 'fs-extra'
import { TunablesCrypto, TunablesManager } from "../../utils/tunables/tunables.js";
export async function getTunablesHandler(req, res){ 
    try {
    // const user = await prisma.user.findFirstOrThrow({
    //     where: {
    //         SessionTicket: req.headers['ros-sessionticket'],
    //     },
    //   });

    //   if(!user) return;

    const enabledTunables = await prisma.tunable.findMany({
        where: {
            enabled: true
        }
    })

    const tunablesManager = new TunablesManager()
    
    for(let tunable of enabledTunables){
        if(tunable.type === "Boolean"){
            tunablesManager.addTunable(tunable.name, tunable.value === "true" ? true : false, tunable.global)
        } else if(tunable.type = "Int"){
            tunablesManager.addTunable(tunable.name, parseInt(tunable.value, 10), tunable.global)
        }
        else if(tunable.type = "Float"){
            tunablesManager.addTunable(tunable.name, parseFloat(tunable.value), tunable.global)
        }
    }
    //const tunablesFile = await fs.readFile('./0x1a098062.json')
    const tunablesCrypto = new TunablesCrypto();
    const modifiedTunables = tunablesManager.getTunables();
    const stringifiedTunables = JSON.stringify(modifiedTunables)
    console.log(stringifiedTunables);
    const encryptedTunables = tunablesCrypto.encrypt(stringifiedTunables)

    // if (encryptedTunables.equals(tunablesFile)) {
    //     console.log("Success: The re-encrypted data matches the original encrypted data!");
    //   } else {
    //     console.log("Error: The re-encrypted data does NOT match the original encrypted data.");
    // }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Cache-Control", "private, max-age=0");
    res.send(encryptedTunables)

    } catch (error) {
        console.log(error)
    }
}