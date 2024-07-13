import React, { useMemo, useEffect, useState, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Plane } from "@react-three/drei";
import * as THREE from "three";
import Modal from "react-modal";
import { ethers } from "ethers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ZirCatsABI from "./ZirCatsABI.json";
import ZirCatNipABI from "./ZirCatNipABI.json";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const contractAddress = "0xD3b647A7b76c8251260662D956001943b0A669A8";
const zirCatNipAddress = "0x52efc82b54E9EFD38865Ed5572fb35bfFd16e87d";

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
  const [totalValueDeposited, setTotalValueDeposited] = useState(0);
  const [isDataReady, setIsDataReady] = useState(false);

  const chartRef = useRef(null);

  useEffect(() => {
    fetchSVGs();
    fetchTotalValueDeposited();
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

  const fetchTotalValueDeposited = async () => {
    if (!provider) return;
    const zirCatNip = new ethers.Contract(zirCatNipAddress, ZirCatNipABI, provider);
    const totalValue = await zirCatNip.totalValueDeposited();
    setTotalValueDeposited(Number(totalValue));
    setIsDataReady(true);
  };

  const getPrice = (supply) => {
    return ((supply * (supply + 1) * (2 * supply + 1)) / 6) * 1e13;
  };

  const generateChartData = () => {
    const labels = Array.from({ length: 101 }, (_, i) => i);
    const data = labels.map(i => getPrice(i) / 1e18);
    
    return {
      labels,
      datasets: [
        {
          label: 'Bonding Curve',
          data: data,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'ZirCatNip Bonding Curve',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Supply',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Price (ETH)',
        },
      },
    },
    animation: false, // Disable animations for better performance
  };

  useEffect(() => {
    if (chartRef.current && isDataReady) {
      const chart = chartRef.current;
      const currentSupply = totalValueDeposited / 1e18;
      const currentPrice = getPrice(currentSupply) / 1e18;

      chart.data.datasets.push({
        label: 'Current Position',
        data: [{ x: currentSupply, y: currentPrice }],
        pointBackgroundColor: 'red',
        pointBorderColor: 'red',
        pointRadius: 6,
        showLine: false,
      });

      chart.update();
    }
  }, [totalValueDeposited, isDataReady]);

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

      const encodedSVG = btoa(newSVG);
      const dataURL = `data:image/svg+xml;base64,${encodedSVG}`;

      const tx = await zirCatNip.burnShareAndMintNFT(dataURL);
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      setIsModalOpen(false);
      setTheme("");
      setNewSVG(null);
      fetchSVGs();
      fetchTotalValueDeposited();
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
      const price = await zirCatNip.calculateBuyPrice(amount);
      const protocolFee = price.mul(3).div(100);
      const totalPrice = price.add(protocolFee);

      const tx = await zirCatNip.buyShares(amount, { value: totalPrice });
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Shares bought successfully!");
      fetchTotalValueDeposited();
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
      fetchTotalValueDeposited();
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
        contentLabel="Generate New Cat"
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#f0f0f0',
            borderRadius: '10px',
            padding: '20px',
            maxWidth: '80%',
            maxHeight: '80%',
            overflow: 'auto'
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.75)'
          }
        }}
      >
        <h2>What theme should your cat be?</h2>
        <input 
          type="text" 
          value={theme} 
          onChange={handleThemeChange} 
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '5px',
            border: '1px solid #ccc'
          }}
        />
        <button 
          onClick={handleThemeSubmit} 
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {isLoading ? "Generating..." : "Generate"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {newSVG && (
          <div>
            <h3>Generated SVG:</h3>
            <div dangerouslySetInnerHTML={{ __html: newSVG }} />
            <button 
              onClick={() => handleMintNFT()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#008CBA',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Mint NFT
            </button>
            <button 
              onClick={() => handleBuyShares(1)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Buy Shares
            </button>
            <button 
              onClick={() => handleSellShares(1)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#555555',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Sell Shares
            </button>
          </div>
        )}
        <div>
          <h3>Bonding Curve</h3>
          <div style={{ width: '600px', height: '400px' }}>
            <Line ref={chartRef} options={chartOptions} data={generateChartData()} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default App;