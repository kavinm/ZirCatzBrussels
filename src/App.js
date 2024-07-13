import React, { useMemo, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Plane } from "@react-three/drei";
import * as THREE from "three";
import Modal from "react-modal";
import { ethers } from "ethers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import ZirCatsABI from "./ZirCatsABI.json";
import ZirCatNipABI from "./ZirCatNipABI.json";

const contractAddress = "0xD3b647A7b76c8251260662D956001943b0A669A8";
const zirCatNipAddress = "0x52efc82b54E9EFD38865Ed5572fb35bfFd16e87d"; // Replace with your ZirCatNip contract address

Modal.setAppElement("#root");

function Camera() {
  const { camera } = useThree();
  useFrame(() => {
    const speed = 0.05;
    if (keys["w"]) camera.position.z -= speed;
    if (keys["s"]) camera.position.z += speed;
    if (keys["a"]) camera.position.x -= speed;
    if (keys["d"]) camera.position.x += speed;
  });
  return null;
}

const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

function Floor() {
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        gridSize: { value: 100.0 },
        lineWidth: { value: 0.02 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float gridSize;
        uniform float lineWidth;
        varying vec2 vUv;
        
        void main() {
          vec2 grid = fract(vUv * gridSize);
          float lineX = step(1.0 - lineWidth, grid.x) + step(grid.x, lineWidth);
          float lineY = step(1.0 - lineWidth, grid.y) + step(grid.y, lineWidth);
          float line = max(lineX, lineY);
          
          vec3 white = vec3(1.0);
          vec3 limeGreen = vec3(0.5, 1.0, 0.0);
          
          vec3 color = mix(white, limeGreen, line);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
  }, []);

  return (
    <Plane
      args={[100, 100]}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}>
      <primitive object={shaderMaterial} />
    </Plane>
  );
}

function NPC({ svgContent, index }) {
  const [texture, setTexture] = useState(null);
  const [position, setPosition] = useState([
    Math.random() * 80 - 40,
    1,
    Math.random() * 80 - 40,
  ]);
  const [direction, setDirection] = useState([1, 1]);

  useEffect(() => {
    if (svgContent) {
      const loader = new THREE.TextureLoader();
      const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
      const url = URL.createObjectURL(svgBlob);
      loader.load(url, (loadedTexture) => {
        loadedTexture.minFilter = THREE.NearestFilter;
        loadedTexture.magFilter = THREE.NearestFilter;
        setTexture(loadedTexture);
        URL.revokeObjectURL(url);
      });
    }
  }, [svgContent]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const offset = (index * Math.PI) / 2;
    const speed = 0.1;

    let newX =
      position[0] + Math.sin(time * 0.3 + offset) * speed * direction[0];
    let newZ =
      position[2] + Math.cos(time * 0.2 + offset) * speed * direction[1];

    if (Math.abs(newX) > 48) {
      setDirection([direction[0] * -1, direction[1]]);
      newX = Math.sign(newX) * 48;
    }
    if (Math.abs(newZ) > 48) {
      setDirection([direction[0], direction[1] * -1]);
      newZ = Math.sign(newZ) * 48;
    }

    setPosition([newX, position[1], newZ]);
  });

  if (!texture) return null;

  return (
    <Plane args={[2, 2]} position={position}>
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
    </Plane>
  );
}

function Scene({ svgs }) {
  return (
    <>
      <Floor />
      <Camera />
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      {svgs.map((svg, index) => (
        <NPC key={svg._id} svgContent={svg.svg} index={index} />
      ))}
    </>
  );
}

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [newSVG, setNewSVG] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [svgs, setSVGs] = useState([]);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  useEffect(() => {
    fetchSVGs();
  }, []);

  useEffect(() => {
    const fetchProvider = async () => {
      if (window.ethereum) {
        const newProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(newProvider);
        const newSigner = await newProvider.getSigner();
        setSigner(newSigner);
      } else {
        console.error("No Ethereum provider found");
      }
    };
    fetchProvider();
  }, []);

  const handleMintNFT = async () => {
    if (!signer) {
      setError("Please connect your wallet first");
      return;
    }
    try {
      const zirCatNip = new ethers.Contract(
        zirCatNipAddress,
        ZirCatNipABI,
        signer
      );

      // Ensure the SVG is not double encoded
      const encodedSVG = btoa(newSVG);
      const dataURL = `${encodedSVG}`;

      const tx = await zirCatNip.burnShareAndMintNFT(dataURL);
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      setIsModalOpen(false);
      setTheme("");
      setNewSVG(null);
      fetchSVGs();
    } catch (error) {
      console.error("Error occurred during minting:", error);
      setError("Minting failed. Please try again.");
    }
  };

  const handleBuyShares = async (amount) => {
    if (!signer) {
      setError("Please connect your wallet first");
      return;
    }
    try {
      const zirCatNip = new ethers.Contract(
        zirCatNipAddress,
        ZirCatNipABI,
        signer
      );
      const totalValueDeposited = await zirCatNip.totalValueDeposited();
      const price = await zirCatNip.getPrice(totalValueDeposited, amount);

      // Convert price to a string if it isn't already
      const priceStr = price.toString();

      // Calculate the protocol fee as 3% of the price
      const protocolFee = ethers.parseEther(
        (Number(ethers.formatEther(priceStr)) * 0.03).toFixed(18)
      );
      const totalPrice = ethers.parseEther(
        (Number(ethers.formatEther(priceStr)) * 1.03).toFixed(18)
      );

      const tx = await zirCatNip.buyShares(amount, { value: totalPrice });
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Shares bought successfully!");
    } catch (error) {
      console.error("Error occurred during buying shares:", error);
      setError("Buying shares failed. Please try again.");
    }
  };

  const handleSellShares = async (amount) => {
    if (!signer) {
      setError("Please connect your wallet first");
      return;
    }
    try {
      const zirCatNip = new ethers.Contract(
        zirCatNipAddress,
        ZirCatNipABI,
        signer
      );
      const tx = await zirCatNip.sellShares(amount);
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Shares sold successfully!");
    } catch (error) {
      console.error("Error occurred during selling shares:", error);
      setError("Selling shares failed. Please try again.");
    }
  };

  const fetchSVGs = async () => {
    try {
      const response = await fetch("http://localhost:3001/get-svgs");
      if (!response.ok) {
        throw new Error("Failed to fetch SVGs");
      }
      const data = await response.json();
      setSVGs(data);
    } catch (error) {
      console.error("Error fetching SVGs:", error);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setError(null);
    setNewSVG(null);
  };

  const handleThemeChange = (event) => {
    setTheme(event.target.value);
  };

  const handleThemeSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:3001/generate-svg", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ theme }),
      });
      if (!response.ok) {
        throw new Error("Failed to generate SVG");
      }
      const data = await response.json();
      if (data.svg) {
        console.log("Received SVG:", data.svg);
        setNewSVG(data.svg);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Error occurred during the API request:", error);
      setError("Failed to generate SVG. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      const response = await fetch("http://localhost:3001/publish-svg", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ svg: newSVG }),
      });
      if (!response.ok) {
        throw new Error("Failed to publish SVG");
      }
      const data = await response.json();
      if (data.success) {
        console.log("SVG published successfully");
        fetchSVGs();
        handleCloseModal();
      } else {
        throw new Error("Failed to publish SVG");
      }
    } catch (error) {
      console.error("Error publishing SVG:", error);
      setError("Failed to publish SVG. Please try again.");
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: 12,
          position: "absolute",
          top: 0,
          right: 0,
          zIndex: 1,
        }}>
        <ConnectButton />
      </div>
      <button onClick={handleOpenModal}>Generate New Cat</button>
      <Canvas
        camera={{ position: [0, 5, 10], fov: 75 }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#006400"));
        }}>
        <Scene svgs={svgs} />
      </Canvas>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={handleCloseModal}
        contentLabel="Generate New Cat">
        <h2>What theme should your cat be?</h2>
        <input type="text" value={theme} onChange={handleThemeChange} />
        <button onClick={handleThemeSubmit} disabled={isLoading}>
          {isLoading ? "Generating..." : "Generate"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {newSVG && (
          <div>
            <h3>Generated SVG:</h3>
            <div dangerouslySetInnerHTML={{ __html: newSVG }} />
            <button onClick={() => handleMintNFT()}>Mint NFT</button>
            <button onClick={() => handleBuyShares(1)}>Buy Shares</button>{" "}
            {/* Add this line */}
            <button onClick={() => handleSellShares(1)}>
              Sell Shares
            </button>{" "}
            {/* Add this line */}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default App;
