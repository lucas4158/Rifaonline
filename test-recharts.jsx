import React from "react";
import { renderToString } from "react-dom/server";
import { PieChart, Pie, Cell } from "recharts";

const data = [{ name: "A", value: 0 }];

try {
  const html = renderToString(
    <PieChart width={400} height={400}>
      <Pie data={data} dataKey="value" />
    </PieChart>
  );
  console.log("Success:", html.length);
} catch (e) {
  console.error("Crash:", e.message);
}
