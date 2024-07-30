import React, { useState } from "react";

export type TracePanelProps = React.PropsWithChildren<{
  summary: string;
  durationMs: number;
  fillPercentage: number;
}>;

export default function TracePanel(props: TracePanelProps) {
  const [isOpen, setOpen] = useState(false);

  return (
    <div>
      <div
        style={{
          padding: "1rem",
          backgroundColor: "gray",
          backgroundImage: `linear-gradient(to right, #fba3007a ${props.fillPercentage}%, rgba(0,0,0,0) ${props.fillPercentage}%)`,
          color: 'black',
          cursor: 'pointer',
        }}
        onClick={() => setOpen(!isOpen)}
      >
        {props.summary} {props.durationMs}ms
      </div>
      {isOpen && <div>{props.children}</div>}
    </div>
  );
}
