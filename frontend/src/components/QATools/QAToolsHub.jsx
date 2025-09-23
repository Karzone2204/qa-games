import React, { useState } from "react";
import TestCaseGen from "./TestCaseGen.jsx";
import DataGen from "./DataGen.jsx";
import AppLinks from "./AppLinks.jsx";
import ConfluenceDebug from "./ConfluenceDebug.jsx";

export default function QAToolsHub(){
  const [tab, setTab] = useState("cases");
  const Tab = ({id, children}) => (
    <div className={`nav-tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{children}</div>
  );

  return (
    <div id="qa-tools" className="content-section active">
      <div className="nav-tabs" style={{marginBottom:16}}>
        <Tab id="cases">🧩 Test Case Generator</Tab>
        <Tab id="data">🧪 Data Generator</Tab>
        <Tab id="links">🔗 App Links</Tab>
        <Tab id="conf">📄 Confluence Search (debug)</Tab>
      </div>
      {tab === "cases" && <TestCaseGen />}
      {tab === "data"  && <DataGen />}
      {tab === "links" && <AppLinks />}
      {tab === "conf"  && <ConfluenceDebug />}
    </div>
  );
}
