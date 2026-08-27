/**
 * Hand-written opcode documentation, merged onto generated table entries.
 *
 * The generated table supplies identity (name, value, direction, family);
 * these supply meaning. Keyed by opcode name so entries survive a table
 * regeneration for a new build.
 *
 * @module opcodes/annotations
 */

export interface OpcodeAnnotation {
  description: string;
  structure?: string;
  example?: string;
}

export const OPCODE_ANNOTATIONS: Record<string, OpcodeAnnotation> = {
  CMSG_CAST_SPELL: {
    description: "Client requests to cast a spell",
    structure: `
struct CMSG_CAST_SPELL {
  uint8 castCount;
  uint32 spellId;
  uint8 castFlags;
  ObjectGuid targetGuid;  // if HAS_TARGET flag
  float x, y, z;          // if HAS_DEST_LOCATION flag
};
`,
    example: "Sent when player clicks a spell button or uses a spell keybind",
  },

  SMSG_SPELL_GO: {
    description: "Server notifies that a spell cast has executed",
    structure: `
struct SMSG_SPELL_GO {
  PackedGuid casterGuid;
  PackedGuid casterUnit;
  uint8 castCount;
  uint32 spellId;
  uint32 castFlags;
  uint32 timestamp;
  uint8 hitTargetCount;
  // ... hit targets ...
  uint8 missTargetCount;
  // ... miss targets ...
};
`,
    example: "Sent when a spell successfully executes its effects",
  },

  CMSG_PLAYER_LOGIN: {
    description: "Client requests to log in with a character",
    structure: `
struct CMSG_PLAYER_LOGIN {
  ObjectGuid characterGuid;
};
`,
    example: "Sent when player selects a character on character selection screen",
  },

  SMSG_LOGIN_VERIFY_WORLD: {
    description: "Server sends world position after login",
    structure: `
struct SMSG_LOGIN_VERIFY_WORLD {
  uint32 mapId;
  float x, y, z, orientation;
};
`,
    example: "Sent after character login to set initial position",
  },

  CMSG_MESSAGECHAT: {
    description: "Client sends a chat message",
    structure: `
struct CMSG_MESSAGECHAT {
  uint32 chatType;
  uint32 language;
  string message;
  // additional fields based on chatType
};
`,
    example: "Sent when player types in chat",
  },

  SMSG_MESSAGECHAT: {
    description: "Server broadcasts a chat message",
    structure: `
struct SMSG_MESSAGECHAT {
  uint8 chatType;
  uint32 language;
  ObjectGuid senderGuid;
  uint32 senderNameLength;
  string senderName;
  ObjectGuid targetGuid;  // for whispers
  uint32 messageLength;
  string message;
};
`,
    example: "Sent to display chat messages to clients",
  },

  MSG_MOVE_START_FORWARD: {
    description: "Player starts moving forward",
    structure: `
struct MSG_MOVE_START_FORWARD {
  PackedGuid guid;
  MovementInfo movementInfo;
};
`,
    example: "Sent when player presses forward movement key",
  },

  MSG_MOVE_STOP: {
    description: "Player stops moving",
    structure: `
struct MSG_MOVE_STOP {
  PackedGuid guid;
  MovementInfo movementInfo;
};
`,
    example: "Sent when player releases movement keys",
  },
};
