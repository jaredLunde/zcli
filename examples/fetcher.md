# Fetcher

A simple fetcher example.

## Available Commands

| Command                                                                  | Description                                               |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| [`fetcher`](#-fetcher)                                                   | Fetch a resource from the internet                        |
| [`fetcher completion`](#-fetcher-completion)                             | Generate an autocompletion script for the specified shell |
| [`fetcher completion bash`](#-fetcher-completion-bash)                   | Generate an autocompletion script for the bash shell      |
| [`fetcher completion fish`](#-fetcher-completion-fish)                   | Generate an autocompletion script for the fish shell      |
| [`fetcher completion help`](#-fetcher-completion-help)                   | Show help for a completion command                        |
| [`fetcher completion help commands`](#-fetcher-completion-help-commands) | List completion commands                                  |
| [`fetcher completion zsh`](#-fetcher-completion-zsh)                     | Generate an autocompletion script for the zsh shell       |
| [`fetcher help`](#-fetcher-help)                                         | Show help for a fetcher command                           |
| [`fetcher help commands`](#-fetcher-help-commands)                       | List fetcher commands                                     |
| [`fetcher version`](#-fetcher-version)                                   | Show version information                                  |

--

## `$ fetcher`

Fetch a resource from the internet

This command will fetch a resource from the internet and print the response.

### Arguments

A URL to fetch.

| Type          | Variadic? | Description |
| ------------- | --------- | ----------- |
| `string(uri)` | No        | The URL     |

### Flags

| Name          | Type                                                        | Required? | Collects? | Default | Description                 |
| ------------- | ----------------------------------------------------------- | --------- | --------- | ------- | --------------------------- |
| --method, -m  | `"POST" \| "GET" \| "PUT" \| "PATCH" \| "DELETE" \| "HEAD"` | No        | No        | `"GET"` | The HTTP method to use      |
| --headers, -H | `string`                                                    | No        | Yes       |         | Add headers to the request  |
| --data, -d    | `string`                                                    | No        | No        |         | Send request data           |
| --verbose, -v | `boolean`                                                   | No        | No        |         | Enable verbose logging      |
| --raw, -r     | `boolean`                                                   | No        | No        |         | Print a raw response output |
| --help, -h    | `boolean`                                                   | No        | No        |         | Show help for a command     |

[**⇗ Back to top**](#available-commands)

--

## `$ fetcher completion`

Generate an autocompletion script for zcli.json in the specified shell.
See each sub-command's help for details on how to use the generated script.

### Flags

| Name          | Type      | Required? | Collects? | Default | Description                 |
| ------------- | --------- | --------- | --------- | ------- | --------------------------- |
| --verbose, -v | `boolean` | No        | No        |         | Enable verbose logging      |
| --raw, -r     | `boolean` | No        | No        |         | Print a raw response output |
| --help, -h    | `boolean` | No        | No        |         | Show help for a command     |

[**⇗ Back to top**](#available-commands)

--

## `$ fetcher completion bash`

Generate the autocompletion script for the bash shell.

This script depends on the 'bash-completion' package.
If it is not installed already, you can install it via your OS's package manager.

To load completions in your current shell session:

```
$ source <(zcli.json completion bash)
```

To load completions for every new session, execute once:

Linux:

```
$ zcli.json completion bash > /etc/bash_completion.d/zcli.json
```

MacOS:

```
$ zcli.json completion bash > /usr/local/etc/bash_completion.d/zcli.json
```

You will need to start a new shell for this setup to take effect.

### Flags

| Name          | Type      | Required? | Collects? | Default | Description                 |
| ------------- | --------- | --------- | --------- | ------- | --------------------------- |
| --verbose, -v | `boolean` | No        | No        |         | Enable verbose logging      |
| --raw, -r     | `boolean` | No        | No        |         | Print a raw response output |
| --help, -h    | `boolean` | No        | No        |         | Show help for a command     |

[**⇗ Back to top**](#available-commands)

--

## `$ fetcher completion fish`

Generate the autocompletion script for the fish shell.

To load completions in your current shell session:

```
$ zcli.json completion fish | source
```

To load completions for every new session, execute once:

```
$ zcli.json completion fish > ~/.config/fish/completions/zcli.json.fish
```

You will need to start a new shell for this setup to take effect.

### Flags

| Name              | Type      | Required? | Collects? | Default | Description                     |
| ----------------- | --------- | --------- | --------- | ------- | ------------------------------- |
| --no-descriptions | `boolean` | No        | No        |         | Disable completion descriptions |
| --verbose, -v     | `boolean` | No        | No        |         | Enable verbose logging          |
| --raw, -r         | `boolean` | No        | No        |         | Print a raw response output     |
| --help, -h        | `boolean` | No        | No        |         | Show help for a command         |

[**⇗ Back to top**](#available-commands)

--

## `$ fetcher completion help`

Show help for a completion command

### Arguments

| Type                                  | Variadic? | Description                   |
| ------------------------------------- | --------- | ----------------------------- |
| `"bash" \| "zsh" \| "fish" \| "help"` | No        | The command to show help for. |

### Flags

| Name          | Type      | Required? | Collects? | Default | Description                 |
| ------------- | --------- | --------- | --------- | ------- | --------------------------- |
| --verbose, -v | `boolean` | No        | No        |         | Enable verbose logging      |
| --raw, -r     | `boolean` | No        | No        |         | Print a raw response output |
| --help, -h    | `boolean` | No        | No        |         | Show help for a command     |

[**⇗ Back to top**](#available-commands)

--

## `$ fetcher completion help commands`

List completion commands

### Flags

| Name          | Type      | Required? | Collects? | Default | Description                              |
| ------------- | --------- | --------- | --------- | ------- | ---------------------------------------- |
| --verbose, -v | `boolean` | No        | No        |         | Enable verbose logging                   |
| --raw, -r     | `boolean` | No        | No        |         | Print a raw response output              |
| --help, -h    | `boolean` | No        | No        |         | Show help for a command                  |
| --all, -a     | `boolean` | No        | No        |         | Show all commands, including hidden ones |

[**⇗ Back to top**](#available-commands)

--

## `$ fetcher completion zsh`

Generate the autocompletion script for the zsh shell.

If shell completion is not already enabled in your environment you will need
to enable it. You can execute the following once:

```
$ echo "autoload -U compinit; compinit" >> ~/.zshrc
```

To load completions for every new session, execute once:

Linux:

```
$ zcli.json completion zsh > "${fpath[1]}/_zcli.json"
```

macOS:

```
$ zcli.json completion zsh > /usr/local/share/zsh/site-functions/_zcli.json
```

Oh My Zsh:

```
$ zcli.json completion zsh > ~/.oh-my-zsh/completions/_zcli.json
```

You will need to start a new shell for this setup to take effect.

### Flags

| Name              | Type      | Required? | Collects? | Default | Description                     |
| ----------------- | --------- | --------- | --------- | ------- | ------------------------------- |
| --no-descriptions | `boolean` | No        | No        |         | Disable completion descriptions |
| --verbose, -v     | `boolean` | No        | No        |         | Enable verbose logging          |
| --raw, -r         | `boolean` | No        | No        |         | Print a raw response output     |
| --help, -h        | `boolean` | No        | No        |         | Show help for a command         |

[**⇗ Back to top**](#available-commands)

--

## `$ fetcher help`

Show help for a fetcher command

### Arguments

| Type                                  | Variadic? | Description                   |
| ------------------------------------- | --------- | ----------------------------- |
| `"version" \| "completion" \| "help"` | No        | The command to show help for. |

### Flags

| Name          | Type      | Required? | Collects? | Default | Description                 |
| ------------- | --------- | --------- | --------- | ------- | --------------------------- |
| --verbose, -v | `boolean` | No        | No        |         | Enable verbose logging      |
| --raw, -r     | `boolean` | No        | No        |         | Print a raw response output |
| --help, -h    | `boolean` | No        | No        |         | Show help for a command     |

[**⇗ Back to top**](#available-commands)

--

## `$ fetcher help commands`

List fetcher commands

### Flags

| Name          | Type      | Required? | Collects? | Default | Description                              |
| ------------- | --------- | --------- | --------- | ------- | ---------------------------------------- |
| --verbose, -v | `boolean` | No        | No        |         | Enable verbose logging                   |
| --raw, -r     | `boolean` | No        | No        |         | Print a raw response output              |
| --help, -h    | `boolean` | No        | No        |         | Show help for a command                  |
| --all, -a     | `boolean` | No        | No        |         | Show all commands, including hidden ones |

[**⇗ Back to top**](#available-commands)

--

## `$ fetcher version`

Shows version information command, including version number and build date.

### Flags

| Name          | Type      | Required? | Collects? | Default | Description                 |
| ------------- | --------- | --------- | --------- | ------- | --------------------------- |
| --verbose, -v | `boolean` | No        | No        |         | Enable verbose logging      |
| --raw, -r     | `boolean` | No        | No        |         | Print a raw response output |
| --help, -h    | `boolean` | No        | No        |         | Show help for a command     |

[**⇗ Back to top**](#available-commands)
