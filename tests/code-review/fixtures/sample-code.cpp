/**
 * Test Fixtures - Sample C++ Code for Testing
 * Contains various code patterns that should trigger different rules
 *
 * NOTE: TrinityCore null safety rules specifically detect missing null checks
 * on TrinityCore pointer types (Player*, Unit*, Creature*, etc.)
 */

// NULL SAFETY VIOLATIONS - TrinityCore Pointer Types

// 1. Player pointer without null check
void HandlePlayerLogin(Player* player) {
    // Missing null check before dereference - should trigger null_safety
    ObjectGuid guid = player->GetGUID();
    std::string name = player->GetName();
    player->SendSystemMessage("Welcome");
}

// 2. Unit pointer without null check
void ProcessUnitDamage(Unit* target) {
    // Missing null check - should trigger null_safety
    uint32 health = target->GetHealth();
    target->CastSpell(target, 12345, true);
}

// 3. Creature pointer without null check
void UpdateCreatureAI(Creature* creature) {
    // Missing null check - should trigger null_safety
    std::string name = creature->GetName();
    creature->SetInCombatWithZone();
}

// 4. Proper null checking (should NOT trigger)
void ProperNullCheck(Player* player) {
    if (!player)
        return;
    player->GetGUID();
}

// MEMORY MANAGEMENT VIOLATIONS

// 5. Memory leak - no delete
void MemoryLeak() {
    Player* player = new Player(nullptr);
    // No delete - should trigger memory leak warning
}

// 6. Double delete
void DoubleFree(Unit* unit) {
    delete unit;
    delete unit; // Should trigger double delete warning
}

// 7. Proper RAII (should NOT trigger)
void ProperRAII() {
    std::unique_ptr<Player> player(new Player(nullptr));
    // Automatic cleanup
}

// CONCURRENCY VIOLATIONS

// 8. Missing mutex protection on shared data
class UnsafeCounter {
    int count = 0;

    void increment() {
        ++count; // Should trigger race condition warning
    }
};

// 9. Proper mutex usage (should NOT trigger)
class SafeCounter {
    int count = 0;
    std::mutex mtx;

    void increment() {
        std::lock_guard<std::mutex> lock(mtx);
        ++count;
    }
};

// CONVENTION VIOLATIONS

// 10. Non-TrinityCore naming (snake_case)
class bad_class_name {
    void bad_method_name() {}
};

// 11. Proper TrinityCore naming (PascalCase)
class GoodClassName {
    void GoodMethodName() {}
};

// SECURITY VIOLATIONS

// 12. SQL injection risk - TrinityCore Query pattern
void SQLInjection(WorldSession* session, const std::string& userInput) {
    std::string query = "SELECT * FROM characters WHERE name = '" + userInput + "'";
    WorldDatabase.Query(query.c_str()); // Should trigger SQL injection warning
}

// 13. Buffer overflow risk
void BufferOverflow(char* dest, const char* src) {
    strcpy(dest, src); // Should trigger buffer overflow warning
}

// PERFORMANCE VIOLATIONS

// 14. Inefficient string concatenation in loop
std::string InefficientConcat() {
    std::string result;
    for (int i = 0; i < 1000; ++i) {
        result += std::to_string(i); // Should trigger performance warning
    }
    return result;
}

// 15. Passing large object by value
struct LargeObject {
    char data[10000];
};

void PassByValue(LargeObject obj) { // Should trigger performance warning
    // Processing
}

// ARCHITECTURE VIOLATIONS

// 16. God class (too many responsibilities)
class GodClass {
    void HandleNetwork() {}
    void HandleDatabase() {}
    void HandleUI() {}
    void HandleLogging() {}
    void HandleSecurity() {}
    void HandleConfiguration() {}
    // Should trigger architecture warning
};

// 17. Proper separation of concerns (should NOT trigger)
class NetworkHandler {
    void HandleNetwork() {}
};

class DatabaseHandler {
    void HandleDatabase() {}
};
