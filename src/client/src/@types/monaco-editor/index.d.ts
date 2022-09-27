declare module 'monaco-editor/esm/vs/base/common/uri' {


export class URI implements UriComponents {
  static isUri(thing: any): thing is URI;
  /**
   * scheme is the 'http' part of 'http://www.example.com/some/path?query#fragment'.
   * The part before the first colon.
   */
  readonly scheme: string;
  /**
   * authority is the 'www.example.com' part of 'http://www.example.com/some/path?query#fragment'.
   * The part between the first double slashes and the next slash.
   */
  readonly authority: string;
  /**
   * path is the '/some/path' part of 'http://www.example.com/some/path?query#fragment'.
   */
  readonly path: string;
  /**
   * query is the 'query' part of 'http://www.example.com/some/path?query#fragment'.
   */
  readonly query: string;
  /**
   * fragment is the 'fragment' part of 'http://www.example.com/some/path?query#fragment'.
   */
  readonly fragment: string;
  /**
   * Returns a string representing the corresponding file system path of this Uri.
   * Will handle UNC paths, normalizes windows drive letters to lower-case, and uses the
   * platform specific path separator.
   *
   * * Will *not* validate the path for invalid characters and semantics.
   * * Will *not* look at the scheme of this Uri.
   * * The result shall *not* be used for display purposes but for accessing a file on disk.
   *
   *
   * The *difference* to `Uri#path` is the use of the platform specific separator and the handling
   * of UNC paths. See the below sample of a file-uri with an authority (UNC path).
   *
   * ```ts
      const u = Uri.parse('file://server/c$/folder/file.txt')
      u.authority === 'server'
      u.path === '/shares/c$/file.txt'
      u.fsPath === '\\server\c$\folder\file.txt'
  ```
   *
   * Using `Uri#path` to read a file (using fs-apis) would not be enough because parts of the path,
   * namely the server name, would be missing. Therefore `Uri#fsPath` exists - it's sugar to ease working
   * with URIs that represent files on disk (`file` scheme).
   */
  get fsPath(): string;
  with(change: {
      scheme?: string;
      authority?: string | null;
      path?: string | null;
      query?: string | null;
      fragment?: string | null;
  }): URI;
  /**
   * Creates a new Uri from a string, e.g. `http://www.example.com/some/path`,
   * `file:///usr/home`, or `scheme:with/path`.
   *
   * @param value A string which represents an Uri (see `Uri#toString`).
   */
  static parse(value: string, _strict?: boolean): URI;
  /**
   * Creates a new Uri from a file system path, e.g. `c:\my\files`,
   * `/usr/home`, or `\\server\share\some\path`.
   *
   * The *difference* between `Uri#parse` and `Uri#file` is that the latter treats the argument
   * as path, not as stringified-uri. E.g. `Uri.file(path)` is **not the same as**
   * `Uri.parse('file://' + path)` because the path might contain characters that are
   * interpreted (# and ?). See the following sample:
   * ```ts
  const good = Uri.file('/coding/c#/project1');
  good.scheme === 'file';
  good.path === '/coding/c#/project1';
  good.fragment === '';
  const bad = Uri.parse('file://' + '/coding/c#/project1');
  bad.scheme === 'file';
  bad.path === '/coding/c'; // path is now broken
  bad.fragment === '/project1';
  ```
   *
   * @param path A file system path (see `Uri#fsPath`)
   */
  static file(path: string): URI;
  static from(components: {
      scheme: string;
      authority?: string;
      path?: string;
      query?: string;
      fragment?: string;
  }): URI;
  /**
   * Join a Uri path with path fragments and normalizes the resulting path.
   *
   * @param uri The input Uri.
   * @param pathFragment The path fragment to add to the Uri path.
   * @returns The resulting Uri.
   */
  static joinPath(uri: URI, ...pathFragment: string[]): URI;
  /**
   * Creates a string representation for this Uri. It's guaranteed that calling
   * `Uri.parse` with the result of this function creates an Uri which is equal
   * to this Uri.
   *
   * * The result shall *not* be used for display purposes but for externalization or transport.
   * * The result will be encoded using the percentage encoding and encoding happens mostly
   * ignore the scheme-specific encoding rules.
   *
   * @param skipEncoding Do not encode the result, default is `false`
   */
  toString(skipEncoding?: boolean): string;
  toJSON(): UriComponents;
  static revive(data: UriComponents | URI): URI;
  static revive(data: UriComponents | URI | undefined): URI | undefined;
  static revive(data: UriComponents | URI | null): URI | null;
  static revive(data: UriComponents | URI | undefined | null): URI | undefined | null;
}

export interface UriComponents {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
}

}
