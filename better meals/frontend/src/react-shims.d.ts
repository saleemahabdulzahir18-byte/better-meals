// Enhanced local React/JSX shims to provide more precise types without @types/react.
// These are not a replacement for the real @types/react package, but they
// provide useful static checking while npm installs aren't available.

type Key = string | number;

export type ReactNode = ReactElement | string | number | boolean | null | undefined | ReactNode[];

export interface ReactElement<P = any> {
  type: any;
  props: P;
  key: Key | null;
}

type SetStateAction<S> = S | ((prevState: S) => S);
type Dispatch<A> = (value: A) => void;

declare namespace JSX {
  // Basic event attributes (kept loose to avoid heavy DOM typing)
  interface DOMAttributes<T> {
    children?: ReactNode;
    // Common events
    onClick?: (e: any) => void;
    onChange?: (e: any) => void;
    onSubmit?: (e: any) => void;
  }

  interface HTMLAttributes<T> extends DOMAttributes<T> {
    id?: string;
    className?: string;
    style?: any;
    role?: string;
    title?: string;
    value?: any;
    placeholder?: string;
    src?: string;
    alt?: string;
    href?: string;
    disabled?: boolean;
  }

  // Map common HTML elements to the generic attribute set.
  interface IntrinsicElements {
    div: HTMLAttributes<HTMLDivElement>;
    span: HTMLAttributes<HTMLSpanElement>;
    p: HTMLAttributes<HTMLParagraphElement>;
    a: HTMLAttributes<HTMLAnchorElement>;
    img: HTMLAttributes<HTMLImageElement>;
    input: HTMLAttributes<HTMLInputElement>;
    button: HTMLAttributes<HTMLButtonElement>;
    form: HTMLAttributes<HTMLFormElement>;
    ul: HTMLAttributes<HTMLUListElement>;
    li: HTMLAttributes<HTMLLIElement>;
    h1: HTMLAttributes<HTMLHeadingElement>;
    h2: HTMLAttributes<HTMLHeadingElement>;
    h3: HTMLAttributes<HTMLHeadingElement>;
    svg: any;
    [elemName: string]: any; // fallback for other elements
  }
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any, key?: any): ReactElement<any>;
  export function jsxs(type: any, props?: any, key?: any): ReactElement<any>;
  export function jsxDEV(type: any, props?: any, key?: any): ReactElement<any>;
}

declare module 'react' {
  // Core types
  export type { ReactNode, ReactElement };

  // Hooks (minimal signatures used by this codebase)
  export function useState<S = any>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T = any>(factory: () => T, deps?: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(cb: T, deps?: any[]): T;

  export const Fragment: any;
  export default {} as any;
}

declare module 'react-dom' {
  const ReactDOM: any;
  export default ReactDOM;
}
