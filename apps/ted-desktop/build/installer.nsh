; "Тед за Windows" – допълнителни стъпки в инсталатора (electron-builder: nsis.include).
;
; Защо: шаблонът на electron-builder разархивира програмата във временната папка на Windows
; (%TEMP%, обикновено на диск C:) и чак после я копира в избраната папка. Ако мястото на диска
; с %TEMP% свърши по средата, Nsis7z::Extract не съобщава грешка и инсталацията "завършва" с
; отрязан .exe ("This app can't run on your PC"). Затова:
;   1) tedPrepare (скрита секция преди инсталацията): ако на диска с %TEMP% няма място, а на
;      диска на избраната папка има – временните файлове се правят до избраната папка;
;      ако няма място никъде – ясно съобщение и отказ, преди да е записано каквото и да е;
;   2) customFiles_x64 (след копирането): проверка, че програмата е цяла, каквато и да е причината.
; Кодове за изход (тиха инсталация /S и CI): 3 = няма място, 4 = непълна инсталация.

!include "LogicLib.nsh"
!include "FileFunc.nsh"

; Временни файлове: app-64.7z (~110 MB) + разархивираните (~360 MB) + копие на инсталатора в
; %LOCALAPPDATA% (~110 MB) = ~580 MB; с малък запас.
!define TED_TEMP_NEED_MB 700
; Когато временните файлове са на диска на инсталацията: ~470 MB временни + ~360 MB програма.
!define TED_SAME_DRIVE_NEED_MB 900
; Истинският .exe е ~240 MB; под този праг файлът със сигурност е отрязан.
!define TED_EXE_MIN_BYTES 150000000

!macro customHeader
  !ifndef BUILD_UNINSTALLER
    Var /GLOBAL tedTmpDrive
    Var /GLOBAL tedInstDrive
    Var /GLOBAL tedTmpFree
    Var /GLOBAL tedInstFree
    Var /GLOBAL tedWork

    ; Изпълнява се преди секцията "install", когато папката за инсталация вече е избрана.
    Section "-tedPrepare"
      StrCpy $tedTmpDrive "$TEMP" 3
      StrCpy $tedInstDrive "$INSTDIR" 3
      ClearErrors
      ${DriveSpace} "$tedTmpDrive" "/D=F /S=M" $tedTmpFree
      ${If} ${Errors}
        ; мрежова или необичайна временна папка: не можем да измерим, не пречим
        ClearErrors
      ${ElseIf} $tedTmpFree < ${TED_TEMP_NEED_MB}
        StrCpy $tedWork ""
        ${If} $tedInstDrive != $tedTmpDrive
          ClearErrors
          ${DriveSpace} "$tedInstDrive" "/D=F /S=M" $tedInstFree
          ${IfNot} ${Errors}
          ${AndIf} $tedInstFree >= ${TED_SAME_DRIVE_NEED_MB}
            ; временна папка до избраната (не вътре в нея: старата версия се изтрива заедно с папката си)
            ${GetParent} "$INSTDIR" $tedWork
            CreateDirectory "$tedWork"
            ClearErrors
            GetTempFileName $tedWork "$tedWork"
            ${IfNot} ${Errors}
              Delete "$tedWork"
              ClearErrors
              CreateDirectory "$tedWork"
              ${If} ${Errors}
                StrCpy $tedWork ""
              ${EndIf}
            ${Else}
              StrCpy $tedWork ""
            ${EndIf}
          ${EndIf}
        ${EndIf}
        ClearErrors
        ${If} $tedWork != ""
          ; NSIS сам изтрива $PLUGINSDIR при излизане
          UnsafeStrCpy $PLUGINSDIR "$tedWork"
        ${Else}
          MessageBox MB_OK|MB_ICONSTOP "Няма достатъчно свободно място за инсталацията.$\r$\n$\r$\nНа диск $tedTmpDrive (временната папка на Windows) има $tedTmpFree MB свободни, а са нужни поне ${TED_TEMP_NEED_MB} MB.$\r$\n$\r$\nКакво да направите - едно от двете:$\r$\n1) освободете място на диск $tedTmpDrive и пуснете инсталатора отново, или$\r$\n2) пуснете инсталатора отново и изберете папка на друг диск с поне ${TED_SAME_DRIVE_NEED_MB} MB свободни.$\r$\n$\r$\n----$\r$\nNot enough free space: drive $tedTmpDrive (Windows temporary folder) has $tedTmpFree MB free, Setup needs ${TED_TEMP_NEED_MB} MB. Free up space there, or install to a folder on another drive with at least ${TED_SAME_DRIVE_NEED_MB} MB free." /SD IDOK
          SetErrorLevel 3
          Quit
        ${EndIf}
      ${EndIf}
    SectionEnd
  !endif
!macroend

!macro tedVerifyInstall
  Push $0
  Push $1
  Push $2
  StrCpy $2 ""
  ${IfNot} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    StrCpy $2 "${APP_EXECUTABLE_FILENAME}"
  ${ElseIfNot} ${FileExists} "$INSTDIR\resources\app.asar"
    StrCpy $2 "resources\app.asar"
  ${ElseIfNot} ${FileExists} "$INSTDIR\v8_context_snapshot.bin"
    StrCpy $2 "v8_context_snapshot.bin"
  ${ElseIfNot} ${FileExists} "$INSTDIR\vulkan-1.dll"
    StrCpy $2 "vulkan-1.dll"
  ${Else}
    ClearErrors
    FileOpen $0 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" r
    ${If} ${Errors}
      StrCpy $2 "${APP_EXECUTABLE_FILENAME}"
    ${Else}
      FileSeek $0 0 END $1
      FileClose $0
      ${If} $1 < ${TED_EXE_MIN_BYTES}
        StrCpy $2 "${APP_EXECUTABLE_FILENAME} ($1 bytes)"
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ClearErrors
  ${If} $2 != ""
    ; Нищо наполовина работещо не остава: отрязаният .exe се изтрива.
    Delete "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    StrCpy $0 "$TEMP" 3
    MessageBox MB_OK|MB_ICONSTOP "Инсталацията не завърши: програмата не е копирана изцяло.$\r$\n(липсва или е непълен файл: $2)$\r$\n$\r$\nНай-честата причина е свършило място на диск $0 (временната папка на Windows) или на диска, на който инсталирате. Освободете място и пуснете инсталатора отново. Ако не помогне, изключете временно антивирусната програма по време на инсталацията.$\r$\n$\r$\n----$\r$\nSetup did not finish: the program files were not copied completely (missing or incomplete: $2). Free up disk space and run Setup again." /SD IDOK
    SetErrorLevel 4
    Quit
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro customFiles_x64
  !insertmacro tedVerifyInstall
!macroend
