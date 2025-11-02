import React from "react";
import { ConfigProvider } from "antd";
import { CitizenshipChatbot } from "./components/CitizenshipChatbot";
import "antd/dist/reset.css";

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
        },
      }}
    >
      <div className="App">
        <CitizenshipChatbot />
      </div>
    </ConfigProvider>
  );
};

export default App;
