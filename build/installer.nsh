; Windows 资源管理器右键菜单：对 .md / .markdown 文件添加"用 SuperMarkdown 打开"
; 写入 HKCR 的 SystemFileAssociations，不抢占默认打开方式，仅追加菜单项
!macro customInstall
  WriteRegStr HKCR "SystemFileAssociations\.md\shell\SuperMarkdown" "MUIVerb" "用 SuperMarkdown 打开"
  WriteRegStr HKCR "SystemFileAssociations\.md\shell\SuperMarkdown" "Icon" "$INSTDIR\SuperMarkdown.exe"
  WriteRegStr HKCR "SystemFileAssociations\.md\shell\SuperMarkdown\command" "" '"$INSTDIR\SuperMarkdown.exe" "%1"'

  WriteRegStr HKCR "SystemFileAssociations\.markdown\shell\SuperMarkdown" "MUIVerb" "用 SuperMarkdown 打开"
  WriteRegStr HKCR "SystemFileAssociations\.markdown\shell\SuperMarkdown" "Icon" "$INSTDIR\SuperMarkdown.exe"
  WriteRegStr HKCR "SystemFileAssociations\.markdown\shell\SuperMarkdown\command" "" '"$INSTDIR\SuperMarkdown.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCR "SystemFileAssociations\.md\shell\SuperMarkdown"
  DeleteRegKey HKCR "SystemFileAssociations\.markdown\shell\SuperMarkdown"
!macroend
