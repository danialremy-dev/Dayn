# Add Git to PATH (Windows)

Git is installed at `C:\Program Files\Git\cmd\` but Windows isn't finding it. Add that folder to your PATH:

## Option A: Using Settings (Windows 10/11)

1. Press **Win + S**, type **environment variables**, open **Edit the system environment variables**.
2. Click **Environment Variables**.
3. Under **User variables**, select **Path** → **Edit**.
4. Click **New** and add:
   ```
   C:\Program Files\Git\cmd
   ```
5. Click **OK** on all windows.
6. **Close Cursor completely** and reopen it. Open a new terminal and run:
   ```
   git --version
   ```

## Option B: Using PowerShell (run as yourself)

Run this in **PowerShell** (you can open it from Start menu):

```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\Git\cmd", "User")
```

Then close and reopen Cursor and try `git --version` in a new terminal.

## Until then: use Git Bash

- Press **Start**, type **Git Bash**, open it.
- In Git Bash, `git` works. Use it for your Git commands:
  ```bash
  cd /c/Users/dania/OneDrive/Documents/Cursor/lifestyle-dashboard
  git init
  git add .
  git commit -m "Initial commit"
  ```
