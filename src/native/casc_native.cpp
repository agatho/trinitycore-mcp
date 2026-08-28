/**
 * CascLib Node.js Native Addon
 *
 * Wraps CascLib C++ library for use in Node.js/TypeScript
 * Provides FileDataID-based file extraction from CASC storages
 */

#include <napi.h>
#include <CascLib.h>
#include <cstring>

/**
 * CASCStorage class - Wraps CASC storage handle
 */
class CASCStorage : public Napi::ObjectWrap<CASCStorage> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  CASCStorage(const Napi::CallbackInfo& info);
  ~CASCStorage();

private:
  static Napi::FunctionReference constructor;

  HANDLE hStorage;
  bool onlineEnabled;

  // Methods
  Napi::Value ExtractFileByID(const Napi::CallbackInfo& info);
  Napi::Value Close(const Napi::CallbackInfo& info);
  Napi::Value IsOpen(const Napi::CallbackInfo& info);
  Napi::Value IsOnline(const Napi::CallbackInfo& info);
  Napi::Value EnumerateFiles(const Napi::CallbackInfo& info);
};

Napi::FunctionReference CASCStorage::constructor;

/**
 * Initialize the CASCStorage class
 */
Napi::Object CASCStorage::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "CASCStorage", {
    InstanceMethod("extractFileByID", &CASCStorage::ExtractFileByID),
    InstanceMethod("close", &CASCStorage::Close),
    InstanceMethod("isOpen", &CASCStorage::IsOpen),
    InstanceMethod("isOnline", &CASCStorage::IsOnline),
    InstanceMethod("enumerateFiles", &CASCStorage::EnumerateFiles)
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("CASCStorage", func);
  return exports;
}

/**
 * Constructor - Opens CASC storage
 *
 * @param info.args[0] - WoW path (string)
 * @param info.args[1] - Locale mask (number, optional, default: CASC_LOCALE_ALL_WOW)
 */
CASCStorage::CASCStorage(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<CASCStorage>(info), hStorage(nullptr) {

  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Validate arguments
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected WoW path as first argument")
      .ThrowAsJavaScriptException();
    return;
  }

  if (!info[0].IsString()) {
    Napi::TypeError::New(env, "WoW path must be a string")
      .ThrowAsJavaScriptException();
    return;
  }

  std::string wowPath = info[0].As<Napi::String>().Utf8Value();
  DWORD localeMask = CASC_LOCALE_ALL_WOW;

  if (info.Length() >= 2 && info[1].IsNumber()) {
    localeMask = info[1].As<Napi::Number>().Uint32Value();
  }

  // Third argument (optional): enable CDN fallback for files whose content is
  // indexed but not present in the local install. A partial WoW installation
  // indexes far more files than it stores; without this they open and then fail
  // to read. CascLib fetches those from Blizzard's CDN transparently.
  onlineEnabled = false;
  if (info.Length() >= 3 && info[2].IsBoolean()) {
    onlineEnabled = info[2].As<Napi::Boolean>().Value();
  }

  // Online mode needs a cache directory (arg 4) and a product code (arg 5).
  std::string cachePath;
  std::string productCode = "wow";
  if (info.Length() >= 4 && info[3].IsString()) {
    cachePath = info[3].As<Napi::String>().Utf8Value();
  }
  if (info.Length() >= 5 && info[4].IsString()) {
    productCode = info[4].As<Napi::String>().Utf8Value();
  }

#ifdef _WIN32
  std::wstring nativePath(wowPath.begin(), wowPath.end());
  LPCTSTR pathArg = nativePath.c_str();
#else
  LPCTSTR pathArg = wowPath.c_str();
#endif

  bool success;

  if (onlineEnabled) {
    // A TRUE online storage. This cannot be a local storage with a flag set:
    // CascOpenStorageEx masks user dwFlags down to CASC_FEATURE_ALLOW_DOWNLOAD
    // (CascOpenStorage.cpp:1505), and ALLOW_DOWNLOAD only lets CascLib fetch
    // internal manifests. Per-file content downloading is gated on
    // CASC_FEATURE_ONLINE (CascOpenFile.cpp:203), which a local storage never
    // receives. So the local install cannot be extended with CDN fallback;
    // fetching missing content requires opening an online storage instead.
    //
    // For an online storage szLocalPath is a CACHE directory, not the install,
    // and it must NOT contain a .build.info or CascLib takes the local branch.
    // The product code is required so CascLib knows which product to resolve.
    if (cachePath.empty()) {
      Napi::Error::New(env, "Online mode requires a cache directory as the 4th argument")
        .ThrowAsJavaScriptException();
      return;
    }

#ifdef _WIN32
    std::wstring nativeCache(cachePath.begin(), cachePath.end());
    LPCTSTR cacheArg = nativeCache.c_str();
    std::wstring nativeCode(productCode.begin(), productCode.end());
    LPCTSTR codeArg = nativeCode.c_str();
#else
    LPCTSTR cacheArg = cachePath.c_str();
    LPCTSTR codeArg = productCode.c_str();
#endif

    CASC_OPEN_STORAGE_ARGS args;
    memset(&args, 0, sizeof(args));
    args.Size = sizeof(CASC_OPEN_STORAGE_ARGS);
    args.szLocalPath = cacheArg;
    args.szCodeName = codeArg;
    args.dwLocaleMask = localeMask;
    args.dwFlags = CASC_FEATURE_ALLOW_DOWNLOAD;

    success = CascOpenStorageEx(nullptr, &args, true, &hStorage);
  } else {
    success = CascOpenStorage(pathArg, localeMask, &hStorage);
  }

  if (!success) {
    DWORD errorCode = GetCascError();
    std::string errorMsg = "Failed to open CASC storage";
    if (onlineEnabled) {
      errorMsg += " (online mode)";
    }
    errorMsg += ": Error code " + std::to_string(errorCode);
    Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
    return;
  }
}

/**
 * Destructor - Closes CASC storage if still open
 */
CASCStorage::~CASCStorage() {
  if (hStorage != nullptr) {
    CascCloseStorage(hStorage);
    hStorage = nullptr;
  }
}

/**
 * Extract file by FileDataID
 *
 * @param info.args[0] - FileDataID (number)
 * @returns Buffer containing file data
 */
Napi::Value CASCStorage::ExtractFileByID(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Check if storage is open
  if (hStorage == nullptr) {
    Napi::Error::New(env, "CASC storage is not open").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Validate arguments
  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "FileDataID must be a number").ThrowAsJavaScriptException();
    return env.Null();
  }

  DWORD fileDataId = info[0].As<Napi::Number>().Uint32Value();

  // Open file by FileDataID
  HANDLE hFile = nullptr;
  bool success = CascOpenFile(
    hStorage,
    CASC_FILE_DATA_ID(fileDataId),  // Convert FileDataID to pointer
    CASC_LOCALE_ALL_WOW,
    CASC_OPEN_BY_FILEID,            // ← Critical flag for FileDataID lookup
    &hFile
  );

  if (!success) {
    DWORD errorCode = GetCascError();
    std::string errorMsg = "Failed to open FileDataID " + std::to_string(fileDataId) +
                          ": Error code " + std::to_string(errorCode);
    Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
    return env.Null();
  }

  // Get file size
  ULONGLONG fileSize = 0;
  if (!CascGetFileSize64(hFile, &fileSize)) {
    CascCloseFile(hFile);
    Napi::Error::New(env, "Failed to get file size").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Validate file size (prevent huge allocations)
  if (fileSize > 100 * 1024 * 1024) {  // 100MB limit
    CascCloseFile(hFile);
    std::string errorMsg = "File too large: " + std::to_string(fileSize) + " bytes (max 100MB)";
    Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
    return env.Null();
  }

  // Allocate buffer
  Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::New(env, static_cast<size_t>(fileSize));
  uint8_t* data = buffer.Data();

  // Read file data
  DWORD bytesRead = 0;
  DWORD remainingBytes = static_cast<DWORD>(fileSize);
  DWORD totalBytesRead = 0;

  while (remainingBytes > 0) {
    DWORD toRead = (remainingBytes > 0x100000) ? 0x100000 : remainingBytes;  // Read in 1MB chunks

    if (!CascReadFile(hFile, data + totalBytesRead, toRead, &bytesRead)) {
      DWORD readError = GetCascError();
      CascCloseFile(hFile);

      std::string errorMsg = "Failed to read file data for FileDataID " +
                             std::to_string(fileDataId) + ": Error code " +
                             std::to_string(readError) + " (read " +
                             std::to_string(totalBytesRead) + " of " +
                             std::to_string(fileSize) + " bytes)";

      // 6002 is ERROR_FILE_ENCRYPTED: the content is present but CascLib has no
      // key for it. Name the missing TACT key, since that is the only actionable
      // detail - no amount of re-downloading will help an encrypted block.
      if (readError == 6002) {
        ULONGLONG keyName = 0;
        if (CascGetNotFoundEncryptionKey(hStorage, &keyName)) {
          char keyBuf[32];
          snprintf(keyBuf, sizeof(keyBuf), "%016llX", (unsigned long long)keyName);
          errorMsg += " - ENCRYPTED, missing TACT key ";
          errorMsg += keyBuf;
        } else {
          errorMsg += " - ENCRYPTED (missing TACT key, name unavailable)";
        }
      }
      Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
      return env.Null();
    }

    totalBytesRead += bytesRead;
    remainingBytes -= bytesRead;

    if (bytesRead == 0) {
      break;  // EOF
    }
  }

  // Close file
  CascCloseFile(hFile);

  // Return buffer (trimmed to actual bytes read if different)
  if (totalBytesRead < fileSize) {
    return Napi::Buffer<uint8_t>::Copy(env, data, totalBytesRead);
  }

  return buffer;
}

/**
 * Close CASC storage
 */
Napi::Value CASCStorage::Close(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (hStorage != nullptr) {
    CascCloseStorage(hStorage);
    hStorage = nullptr;
  }

  return env.Undefined();
}

/**
 * Check if storage is open
 */
Napi::Value CASCStorage::IsOpen(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, hStorage != nullptr);
}

/**
 * Whether this storage was opened with CDN fallback enabled
 */
Napi::Value CASCStorage::IsOnline(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, onlineEnabled);
}

/**
 * Enumerate files in the storage.
 *
 * This reports what CASC itself indexes, which is independent of any community
 * listfile. Files the listfile does not name still appear here, with their
 * FileDataID, so this is the way to find out whether a listfile-driven
 * extraction is missing tables entirely.
 *
 * @param info.args[0] - Name mask (string, optional, default "*")
 * @param info.args[1] - Max results (number, optional, default 200000)
 * @returns Array of { name, fileDataId, size }
 */
Napi::Value CASCStorage::EnumerateFiles(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (hStorage == nullptr) {
    Napi::Error::New(env, "CASC storage is not open").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string mask = "*";
  if (info.Length() >= 1 && info[0].IsString()) {
    mask = info[0].As<Napi::String>().Utf8Value();
  }

  uint32_t limit = 200000;
  if (info.Length() >= 2 && info[1].IsNumber()) {
    limit = info[1].As<Napi::Number>().Uint32Value();
  }

  CASC_FIND_DATA findData;
  memset(&findData, 0, sizeof(findData));

  HANDLE hFind = CascFindFirstFile(hStorage, mask.c_str(), &findData, nullptr);
  if (hFind == nullptr) {
    // No matches is not an error; return an empty array.
    return Napi::Array::New(env, 0);
  }

  Napi::Array results = Napi::Array::New(env);
  uint32_t index = 0;

  do {
    if (index >= limit) {
      break;
    }

    Napi::Object entry = Napi::Object::New(env);
    entry.Set("name", Napi::String::New(env, findData.szFileName));
    entry.Set("size", Napi::Number::New(env, static_cast<double>(findData.FileSize)));

    // CASC_INVALID_ID means this storage does not expose a FileDataID for the entry.
    if (findData.dwFileDataId != CASC_INVALID_ID) {
      entry.Set("fileDataId", Napi::Number::New(env, findData.dwFileDataId));
    } else {
      entry.Set("fileDataId", env.Null());
    }

    results.Set(index++, entry);
  } while (CascFindNextFile(hFind, &findData));

  CascFindClose(hFind);
  return results;
}

/**
 * Module initialization
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return CASCStorage::Init(env, exports);
}

NODE_API_MODULE(casc_native, Init)
