import { Button } from "@my-project/ui-core";

export const meta = () => {
  return [
    { title: "My Project" },
    { name: "description", content: "Welcome to My Project" },
  ];
};

const Home = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">
          My Project Template
        </h1>
        <p className="text-lg text-gray-600">
          モノレポ構成のWebアプリケーションテンプレート
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="primary">Get Started</Button>
          <Button variant="outline">Documentation</Button>
        </div>
      </div>
    </div>
  );
};

export default Home;
