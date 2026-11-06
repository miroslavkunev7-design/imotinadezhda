; Default install directory D:\ImotiNadezhda-Settings (English folder name per canon)
!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\ImotiNadezhda-Settings"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "D:\ImotiNadezhda-Settings"
!macroend

!macro customInit
  StrCpy $INSTDIR "D:\ImotiNadezhda-Settings"
!macroend
