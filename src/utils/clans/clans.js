export class ClanPermissions {
    constructor() {
        // Define permission flags as BigInt for handling large numbers.
        this.permissions = {
            RL_CLAN_PERMISSION_SYSTEM_SET: BigInt(0x01),
            RL_CLAN_PERMISSION_DISBAND: BigInt(0x02),
            RL_CLAN_PERMISSION_KICK: BigInt(0x04),
            RL_CLAN_PERMISSION_INVITE: BigInt(0x08),
            RL_CLAN_PERMISSION_PROMOTE: BigInt(0x10),
            RL_CLAN_PERMISSION_DEMOTE: BigInt(0x20),
            RL_CLAN_PERMISSION_RANKMANAGER: BigInt(0x40),
            RL_CLAN_PERMISSION_WRITEONWALL: BigInt(0x100),
            RL_CLAN_PERMISSION_DELETEFROMWALL: BigInt(0x200),
            RL_CLAN_PERMISSION_WRITEINCLOUDE: BigInt(0x400),
            RL_CLAN_PERMISSION_CREWEDIT: BigInt(0x800),
            RESERVED_RL_CLAN_PERMISSION_NOFLAGS: BigInt(0x8000000000000000) // Reserved flag
        };
    }

    // Decode the permissions from a given bitmask value (BigInt)
    decodePermissions(bitmask) {
        let decoded = [];
        for (const [permissionName, flag] of Object.entries(this.permissions)) {
            if ((bitmask & flag) === flag) {
                decoded.push(permissionName);
            }
        }
        return decoded;
    }

    // Encode an array of permissions into a bitmask (BigInt)
    encodePermissions(permissionArray) {
        let bitmask = BigInt(0);
        for (const permission of permissionArray) {
            if (this.permissions[permission] !== undefined) {
                bitmask |= this.permissions[permission];
            } else {
                console.warn(`Unknown permission: ${permission}`);
            }
        }
        return bitmask;
    }

    // Log out the decoded permissions based on the bitmask
    logDecodedPermissions(bitmask) {
        console.log(`Decoded permissions for bitmask ${bitmask}:`);
        const decodedPermissions = this.decodePermissions(bitmask);
        if (decodedPermissions.length > 0) {
            decodedPermissions.forEach(permission => {
                console.log(`- ${permission}`);
            });
        } else {
            console.log("No permissions found.");
        }
    }
}
