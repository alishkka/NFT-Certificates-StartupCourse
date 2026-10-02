import React from "react";
import { createRoot } from "react-dom/client";
import CertificateApp from "../app/certificate-app";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><CertificateApp /></React.StrictMode>);
