import crypto from "crypto";
import aesjs from "aes-js";

export class TunablesCrypto {
  constructor() {
    // Ensure the key is 16 bytes (128 bits)
    this.key = Buffer.from("F06F12F49B843DADE4A7BE053505B19C9E415C95D93753450A269144D59A0115", "hex");
  }

  // Encrypt data from a JSON object
  encrypt(plaintext) {
    const textBytes = Buffer.from(plaintext, "utf-8");

    // Length of the data rounded down to multiple of 16 bytes
    const encryptedLength = textBytes.length - (textBytes.length % 16);

    // Encrypt the data that is a multiple of 16 bytes
    const aesEcb = new aesjs.ModeOfOperation.ecb(this.key);
    const encryptedBytes = aesEcb.encrypt(textBytes.slice(0, encryptedLength));

    // Concatenate remaining unencrypted bytes (if any)
    return Buffer.concat([Buffer.from(encryptedBytes), textBytes.slice(encryptedLength)]);
  }

  // Decrypt data from a buffer
  decrypt(encrypted) {
    const encryptedLength = encrypted.length - (encrypted.length % 16);
    const aesEcb = new aesjs.ModeOfOperation.ecb(this.key);
    const decryptedBytes = aesEcb.decrypt(encrypted.slice(0, encryptedLength));

    // Concatenate decrypted and remaining bytes
    return Buffer.concat([Buffer.from(decryptedBytes), encrypted.slice(encryptedLength)]).toString();
  }
}

const defaultTunables = {
  version: 1,
  format: 0,
  poolSize: 2000,
  tunables: {
    MP_GLOBAL: {
      CAPS_ARE_ENFORED: [{ value: true }],
      ELO_SEASON: [{ value: 3 }],
      CURRENTVEHICLESALESTUSEASON: [{ value: 1 }],
      CURRENTVEHICLESALESSEASON: [{ value: 2 }],
      EXPIRED_CHALLENGE_TURN_OFF_XP_REWARD: [{ value: true }],
      TURN_ON_VALENTINES_EVENT: [{ value: true }],
      TURN_ON_VALENTINE_MASKS: [{ value: true }],
      TURN_ON_VALENTINE_WEAPON: [{ value: true }],
      TURN_ON_VALENTINE_VEHICLE: [{ value: true }],
      TURN_ON_VALENTINE_HAIR: [{ value: true }],
      TURN_ON_VALENTINE_CLOTHING: [{ value: true }],
      LUXE2_ALL_UPPERS: [{ value: 0.8 }],
      LUXE2_ALL_EARRINGS: [{ value: 0.8 }],
      LUXE2_ALL_SCARVES: [{ value: 0.8 }],
      LUXE2_ALL_CUFFS: [{ value: 0.8 }],
      LUXE2_ALL_CHAINS: [{ value: 0.8 }],
      MP_VEHICLE_LB_NO_WRITE: [{ value: true }],
      FEMALE_UPPERS_HEAVY_UTILITY_VEST: [{ value: 19500 }],
      MALE_UPPERS_HEAVY_UTILITY_VEST: [{ value: 19500 }],
      FEMALE_UPPERS_BLACK_HEAVY_UTILITY_VEST: [{ value: 20000 }],
      MALE_UPPERS_BLACK_HEAVY_UTILITY_VEST: [{ value: 20000 }],
      MM_NUM_QUICKMATCH_OVERALL_RESULTS_BEFORE_EARLY_OUT: [{ value: 6 }],
      SESSION_TIME_MM_MULTIPLE_SESSIONS: [{ value: 100000 }],
      NJVS_SYNC_WINDOW: [{ value: 180 }],
      DISABLE_CHRISTMAS_VEHICLES: [{ value: false }],
      ALLOW_IMMEDIATE_TRANSITION_LAUNCH_DURING_JOIN: [{ value: false }],
      NUMBER_OF_VEHICLES_SOLD_IN_A_DAY: [{ value: 100 }],
      PERMANENTCAPREPEATOFFENDER1: [{ value: 172800 }],
      PERMANENTCAPREPEATOFFENDER2: [{ value: 172800 }],
      REPEAT_OFFENDERS_CAPS_ARE_ENFORCED: [{ value: true }],
      USE_DAILY_OBJECTIVE_LIMITED_POOL: [{ value: true }],
      OBJECTIVE_POOL_SIZE: [{ value: 50 }],
      NUM_JOB_OBJECTIVES_IN_POOL: [{ value: 19 }],
      MP_DAILY_OBJECTIVE_POOL_0: [{ value: 0 }],
      MP_DAILY_OBJECTIVE_POOL_1: [{ value: 1 }],
      MP_DAILY_OBJECTIVE_POOL_2: [{ value: 2 }],
      MP_DAILY_OBJECTIVE_POOL_3: [{ value: 3 }],
      MP_DAILY_OBJECTIVE_POOL_4: [{ value: 4 }],
      MP_DAILY_OBJECTIVE_POOL_5: [{ value: 5 }],
      MP_DAILY_OBJECTIVE_POOL_6: [{ value: 6 }],
      MP_DAILY_OBJECTIVE_POOL_7: [{ value: 7 }],
      MP_DAILY_OBJECTIVE_POOL_8: [{ value: 8 }],
      MP_DAILY_OBJECTIVE_POOL_9: [{ value: 9 }],
      MP_DAILY_OBJECTIVE_POOL_10: [{ value: 10 }],
      MP_DAILY_OBJECTIVE_POOL_11: [{ value: 11 }],
      MP_DAILY_OBJECTIVE_POOL_12: [{ value: 12 }],
      MP_DAILY_OBJECTIVE_POOL_13: [{ value: 13 }],
      MP_DAILY_OBJECTIVE_POOL_14: [{ value: 14 }],
      MP_DAILY_OBJECTIVE_POOL_15: [{ value: 15 }],
      MP_DAILY_OBJECTIVE_POOL_16: [{ value: 16 }],
      MP_DAILY_OBJECTIVE_POOL_17: [{ value: 17 }],
      MP_DAILY_OBJECTIVE_POOL_18: [{ value: 18 }],
      MP_DAILY_OBJECTIVE_POOL_19: [{ value: 19 }],
      MP_DAILY_OBJECTIVE_POOL_20: [{ value: 20 }],
      MP_DAILY_OBJECTIVE_POOL_21: [{ value: 21 }],
      MP_DAILY_OBJECTIVE_POOL_22: [{ value: 22 }],
      MP_DAILY_OBJECTIVE_POOL_23: [{ value: 23 }],
      MP_DAILY_OBJECTIVE_POOL_24: [{ value: 24 }],
      MP_DAILY_OBJECTIVE_POOL_25: [{ value: 25 }],
      MP_DAILY_OBJECTIVE_POOL_26: [{ value: 26 }],
      MP_DAILY_OBJECTIVE_POOL_27: [{ value: 27 }],
      MP_DAILY_OBJECTIVE_POOL_28: [{ value: 28 }],
      MP_DAILY_OBJECTIVE_POOL_29: [{ value: 29 }],
      MP_DAILY_OBJECTIVE_POOL_30: [{ value: 31 }],
      MP_DAILY_OBJECTIVE_POOL_31: [{ value: 32 }],
      MP_DAILY_OBJECTIVE_POOL_32: [{ value: 33 }],
      MP_DAILY_OBJECTIVE_POOL_33: [{ value: 34 }],
      MP_DAILY_OBJECTIVE_POOL_34: [{ value: 35 }],
      MP_DAILY_OBJECTIVE_POOL_35: [{ value: 36 }],
      MP_DAILY_OBJECTIVE_POOL_36: [{ value: 37 }],
      MP_DAILY_OBJECTIVE_POOL_37: [{ value: 38 }],
      MP_DAILY_OBJECTIVE_POOL_38: [{ value: 39 }],
      MP_DAILY_OBJECTIVE_POOL_39: [{ value: 40 }],
      MP_DAILY_OBJECTIVE_POOL_40: [{ value: 41 }],
      MP_DAILY_OBJECTIVE_POOL_41: [{ value: 42 }],
      MP_DAILY_OBJECTIVE_POOL_42: [{ value: 43 }],
      MP_DAILY_OBJECTIVE_POOL_43: [{ value: 44 }],
      MP_DAILY_OBJECTIVE_POOL_44: [{ value: 45 }],
      MP_DAILY_OBJECTIVE_POOL_45: [{ value: 46 }],
      MP_DAILY_OBJECTIVE_POOL_46: [{ value: 47 }],
      MP_DAILY_OBJECTIVE_POOL_47: [{ value: 48 }],
      MP_DAILY_OBJECTIVE_POOL_48: [{ value: 49 }],
      MP_DAILY_OBJECTIVE_POOL_49: [{ value: 50 }],
    },
    BASE_GLOBALS: { SP_VEHICLE_LB_NO_WRITE: [{ value: true }] },
  },
};

export class TunablesManager {
  /**
   * Initializes the TunablesManager class with base tunables.
   * If no base tunables are provided, an empty MP_GLOBAL object is created.
   *
   * @param {Object} baseTunables - The base tunables (optional).
   */
  constructor(baseTunables = defaultTunables) {
    // Ensure the base tunables contain MP_GLOBAL or initialize it as an empty object
    this.baseTunables = baseTunables;
  }

  /**
   * Adds a new tunable to the MP_GLOBAL section in the format:
   * "TUNABLENAME":[{"value": TUNABLEVALUE}]
   *
   * @param {string} tunableName - The name of the tunable.
   * @param {any} tunableValue - The value of the tunable (can be string, number, boolean).
   */
  addTunable(tunableName, tunableValue, global) {
    // Automatically format the new tunable
    if (global === "MP_GLOBALS") {
      console.log(`Adding Tunable: ${tunableName} with value: ${tunableValue} to MP_GLOBAL`);
      this.baseTunables.tunables.MP_GLOBAL[tunableName] = [{ value: tunableValue }];
    }
    if (global === "BASE_GLOBALS") {
      console.log(`Adding Tunable: ${tunableName} with value: ${tunableValue} to BASE_GLOBALS`);
      this.baseTunables.tunables.BASE_GLOBALS[tunableName] = [{ value: tunableValue }];
    }
  }

  /**
   * Deletes the Tunable from the MP_GLOBAL Section:
   * "TUNABLENAME":[{"value": TUNABLEVALUE}]
   *
   * @param {string} tunableName - The name of the tunable.
   */
  deleteTunable(tunableName) {
    // Automatically format the new tunable
    delete this.baseTunables.tunables.MP_GLOBAL[tunableName];
  }

  /**
   * Returns the updated tunables as a JSON object.
   *
   * @returns {Object} The updated tunables with the MP_GLOBAL section.
   */
  getTunables() {
    return this.baseTunables;
  }

  /**
   * Outputs the tunables in a pretty-printed JSON string format.
   *
   * @returns {string} The tunables formatted as a JSON string.
   */
  printTunables() {
    return JSON.stringify(this.baseTunables, null, 2);
  }
}
