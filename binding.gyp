{
  "targets": [
    {
      "target_name": "casc_native",
      "sources": [
        "src/native/casc_native.cpp",
        "src/native/overwatch_stub.cpp",
        "dep/CascLib/src/CascOpenStorage.cpp",
        "dep/CascLib/src/CascOpenFile.cpp",
        "dep/CascLib/src/CascReadFile.cpp",
        "dep/CascLib/src/CascFindFile.cpp",
        "dep/CascLib/src/CascRootFile_WoW.cpp",
        "dep/CascLib/src/CascRootFile_TVFS.cpp",
        "dep/CascLib/src/CascRootFile_Text.cpp",
        "dep/CascLib/src/CascRootFile_Diablo3.cpp",
        "dep/CascLib/src/CascRootFile_Install.cpp",
        "dep/CascLib/src/CascRootFile_MNDX.cpp",
        "dep/CascLib/src/CascIndexFiles.cpp",
        "dep/CascLib/src/CascFiles.cpp",
        "dep/CascLib/src/CascDecrypt.cpp",
        "dep/CascLib/src/CascDecompress.cpp",
        "dep/CascLib/src/CascDumpData.cpp",
        "dep/CascLib/src/common/Common.cpp",
        "dep/CascLib/src/common/ListFile.cpp",
        "dep/CascLib/src/common/FileTree.cpp",
        "dep/CascLib/src/common/FileStream.cpp",
        "dep/CascLib/src/common/Directory.cpp",
        "dep/CascLib/src/common/RootHandler.cpp",
        "dep/CascLib/src/common/Csv.cpp",
        "dep/CascLib/src/common/Mime.cpp",
        "dep/CascLib/src/common/Sockets.cpp",
        "dep/CascLib/src/hashes/md5.cpp",
        "dep/CascLib/src/hashes/sha1.cpp",
        "dep/CascLib/src/jenkins/lookup3.c",
        "dep/zlib/adler32.c",
        "dep/zlib/compress.c",
        "dep/zlib/crc32.c",
        "dep/zlib/deflate.c",
        "dep/zlib/gzclose.c",
        "dep/zlib/gzlib.c",
        "dep/zlib/gzread.c",
        "dep/zlib/gzwrite.c",
        "dep/zlib/infback.c",
        "dep/zlib/inffast.c",
        "dep/zlib/inflate.c",
        "dep/zlib/inftrees.c",
        "dep/zlib/trees.c",
        "dep/zlib/uncompr.c",
        "dep/zlib/zutil.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "dep/CascLib/src",
        "dep"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "_7ZIP_ST",
        "__CASCLIB_SELF__"
      ],
      "conditions": [
        ["OS=='win'", {
          "defines": [
            "UNICODE",
            "_UNICODE",
            "WIN32",
            "_WINDOWS"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "RuntimeLibrary": 2
            }
          }
        }],
        ["OS=='linux'", {
          "cflags": ["-fexceptions", "-std=c++17"],
          "cflags_cc": ["-fexceptions", "-std=c++17"]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "CLANG_CXX_LIBRARY": "libc++"
          }
        }]
      ]
    }
  ]
}
