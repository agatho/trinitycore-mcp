/**
 * Test Fixtures - Sample C++ Code for Testing
 * Contains various code patterns that should trigger different rules
 */

// NULL SAFETY VIOLATIONS

// 1. Null pointer dereference without check
void nullDereference(int* ptr) {
    *ptr = 42; // Should trigger null safety warning
}

// 2. Missing null check after allocation
void missingNullCheck() {
    int* data = new int[100];
    data[0] = 1; // Should trigger null safety warning
}

// 3. Proper null checking (should NOT trigger)
void properNullCheck(int* ptr) {
    if (!ptr)
        return;
    *ptr = 42;
}

// MEMORY MANAGEMENT VIOLATIONS

// 4. Memory leak - no delete
void memoryLeak() {
    int* data = new int[100];
    // No delete[] - should trigger memory leak warning
}

// 5. Double delete
void doubleFree(int* ptr) {
    delete ptr;
    delete ptr; // Should trigger double delete warning
}

// 6. Proper RAII (should NOT trigger)
void properRAII() {
    std::unique_ptr<int[]> data(new int[100]);
    // Automatic cleanup
}

// CONCURRENCY VIOLATIONS

// 7. Missing mutex protection
class UnsafeCounter {
    int count = 0;

    void increment() {
        ++count; // Should trigger race condition warning
    }
};

// 8. Proper mutex usage (should NOT trigger)
class SafeCounter {
    int count = 0;
    std::mutex mtx;

    void increment() {
        std::lock_guard<std::mutex> lock(mtx);
        ++count;
    }
};

// CONVENTION VIOLATIONS

// 9. Non-TrinityCore naming (snake_case)
class bad_class_name {
    void bad_method_name() {}
};

// 10. Proper TrinityCore naming (PascalCase)
class GoodClassName {
    void GoodMethodName() {}
};

// SECURITY VIOLATIONS

// 11. SQL injection risk
void sqlInjection(const std::string& userInput) {
    std::string query = "SELECT * FROM users WHERE name = '" + userInput + "'";
    // Should trigger SQL injection warning
}

// 12. Buffer overflow risk
void bufferOverflow(char* dest, const char* src) {
    strcpy(dest, src); // Should trigger buffer overflow warning
}

// PERFORMANCE VIOLATIONS

// 13. Inefficient string concatenation in loop
std::string inefficientConcat() {
    std::string result;
    for (int i = 0; i < 1000; ++i) {
        result += std::to_string(i); // Should trigger performance warning
    }
    return result;
}

// 14. Passing large object by value
struct LargeObject {
    char data[10000];
};

void passByValue(LargeObject obj) { // Should trigger performance warning
    // Processing
}

// ARCHITECTURE VIOLATIONS

// 15. God class (too many responsibilities)
class GodClass {
    void handleNetwork() {}
    void handleDatabase() {}
    void handleUI() {}
    void handleLogging() {}
    void handleSecurity() {}
    void handleConfiguration() {}
    // Should trigger architecture warning
};

// 16. Proper separation of concerns (should NOT trigger)
class NetworkHandler {
    void handleNetwork() {}
};

class DatabaseHandler {
    void handleDatabase() {}
};
