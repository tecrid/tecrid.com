import type { ComponentProps } from "react";

export default function Link(props: ComponentProps<"a">) {
  const { children, ...anchorProps } = props;
  return <a {...anchorProps}>{children}</a>;
}
