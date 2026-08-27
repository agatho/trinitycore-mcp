// tests/opcodes/fixtures/sample-opcodes.cs
using WowPacketParser.Misc;

namespace WowPacketParser.Enums.Version.V12_1_0_69214
{
    // Generated from V12_0_7_67808 by applying the 12.1 protocol channel-id shift.
    public static class Opcodes_12_1_0
    {
        public static BiDictionary<Opcode, int> Opcodes(Direction direction)
        {
            switch (direction)
            {
                case Direction.ClientToServer:
                    return ClientOpcodes;
                default:
                    return MiscOpcodes;
            }
        }

        private static readonly BiDictionary<Opcode, int> ClientOpcodes = new()
        {
            { Opcode.CMSG_ACCEPT_GUILD_INVITE, 0x430029 },
            // a comment between entries
            { Opcode.CMSG_ACCEPT_TRADE, 0x3D0004 },
        };

        private static readonly BiDictionary<Opcode, int> ServerOpcodes = new()
        {
            { Opcode.SMSG_ABORT_NEW_WORLD, 0x450030 },
        };

        private static readonly BiDictionary<Opcode, int> MiscOpcodes = new();
    }
}
