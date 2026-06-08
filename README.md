How to upload and modify files:
**Init steps:**
1. Install git (https://git-scm.com/install/windows)
2. Open git bash, type **ssh-keygen** and click enter few times until you are getting to the init prompt
3. Open C:\Users\<username>\.ssh\id_ed25519.pub (notepad), copy the text 
4. Open GitHub (browser)
   --> Click profile icon (top right)
   --> Settings
   --> SSH and GPG keys
   --> New SSH Key (green button)
   --> Add any title (E.g. UserName_machine name) - if having more than one computer each will need a different access key
   --> Key type Authentication Key
   --> Key: paste the value from step 3 above
   --> Click Add SSH Key
5. Create a local (empty) folder where all resources (yours and others) will be located (E.g. C:\GitHub\3DXpert_AI)
6. Open git bash
7. Navigate to the folder (use / and not \\ with a leading /c) E.g. **cd /c/GitHub/3DXpert_AI**
8. type **git clone git@github.com:oqton/3DXpert_QA_AI_Implementation.git .** (include the . at the end)
    after this step, all other sources will be downloaded to the machine.
9. Copy all files\folders to be uploaded
10. Back to the git bash, type:
    --> **git add .**
    --> **git commit -m "any description E.g. first upload"**
    --> **git push**

**whenever adding new files repeat step 10**

