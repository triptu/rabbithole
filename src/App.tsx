import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import "./index.css";

export function App() {
  return (
    <div className="container mx-auto p-8 text-center relative z-10">
      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="text-3xl font-bold">Hello!</CardTitle>
        </CardHeader>
        <CardContent>
          Bun + React + ShadCN + Tailwind Template
        </CardContent>
      </Card>
    </div>
  );
}
