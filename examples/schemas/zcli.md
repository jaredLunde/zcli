# fetcher

|         |       |
| ------- | ----- |
| Version | 1.3.2 |

## `$ fetcher`

Fetch a resource from the internet

This command will fetch a resource from the internet and print the response.

### Arguments

| Position | Type     | Variadic? | Description |
| -------- | -------- | --------- | ----------- |
| 0        | `string` | false     |             |

### Flags

| Name          | Type      | Required? | Collects? | Default | Description                 |
| ------------- | --------- | --------- | --------- | ------- | --------------------------- |
| --method, -m  | `string`  | No        | No        | GET     | The HTTP method to use      |
| --headers, -H | `string`  | No        | Yes       |         | Add headers to the request  |
| --data, -d    | `string`  | No        | No        |         | Send request data           |
| --verbose, -v | `boolean` | No        | No        |         | Enable verbose logging      |
| --raw, -r     | `boolean` | No        | No        |         | Print a raw response output |
| --help, -h    | `boolean` | Yes       | No        |         | Show help for a command     |
