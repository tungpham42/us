import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  Input,
  Button,
  List,
  Avatar,
  Typography,
  Space,
  Select,
  Switch,
  Slider,
  Row,
  Col,
  Statistic,
  Alert,
  message,
  Modal,
} from "antd";
import {
  SendOutlined,
  AudioOutlined,
  UserOutlined,
  RobotOutlined,
  PauseOutlined,
  ExclamationCircleOutlined,
  BugOutlined,
} from "@ant-design/icons";
import { ChatMessage, VoiceSettings, ExamQuestion } from "../types";
import { GeminiService } from "../services/geminiService";
import { VoiceService } from "../services/voiceService";
import { LipSyncFace } from "./LipSyncFace";

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

export const CitizenshipChatbot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    gender: "male",
    rate: 1,
    pitch: 1,
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [currentQuestion, setCurrentQuestion] = useState<ExamQuestion | null>(
    null
  );
  const [browserSupport, setBrowserSupport] = useState({
    speech: true,
    recognition: true,
  });
  const [debugVisible, setDebugVisible] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);

  const geminiService = useRef(new GeminiService());
  const voiceService = useRef(new VoiceService(geminiService.current)); // Pass GeminiService instance
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vs = voiceService.current;

    // Check browser support
    const speechSupported =
      vs.isSpeechSupported?.() ?? "speechSynthesis" in window;
    const recognitionSupported =
      vs.isRecognitionSupported?.() ??
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

    setBrowserSupport({
      speech: speechSupported,
      recognition: recognitionSupported,
    });

    // Load available voices for debug info
    setTimeout(() => {
      const voices = vs.getAvailableVoices?.();
      if (voices) {
        setAvailableVoices(voices.map((v) => `${v.name} (${v.lang})`));
      }
    }, 1000);

    // Initialize with welcome message
    const welcomeMessage: ChatMessage = {
      id: "1",
      content:
        "Welcome to US Citizenship Exam Preparation! I'll help you practice for your citizenship test. Let's start with your first question!",
      sender: "bot",
      timestamp: new Date(),
      type: "text",
    };
    setMessages([welcomeMessage]);

    // Generate and ask first question
    generateNewQuestion();

    // Cleanup function to stop speech when component unmounts
    return () => {
      if (vs) {
        vs.stop();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const generateNewQuestion = async () => {
    try {
      const question = await geminiService.current.generateExamQuestion();
      setCurrentQuestion(question);

      const questionMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: question.question,
        sender: "bot",
        timestamp: new Date(),
        type: "text",
        isQuestion: true,
        metadata: {
          category: question.category,
        },
      };

      setMessages((prev) => [...prev, questionMessage]);
      await speakMessage(question.question);
    } catch (error) {
      console.error("Error generating question:", error);
      message.error("Failed to generate question. Please try again.");
    }
  };

  const speakMessage = async (text: string) => {
    if (!voiceSettings.enabled || !browserSupport.speech) return;

    try {
      setIsSpeaking(true);
      console.log("Speaking with settings:", voiceSettings);
      await voiceService.current.speak(text, voiceSettings);
    } catch (error: any) {
      console.error("Error speaking:", error);
      // Don't show error for canceled speech - it's usually intentional
      if (!error.message.includes("canceled")) {
        message.error("Speech error. Please check your audio settings.");
      }
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentQuestion) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputText,
      sender: "user",
      timestamp: new Date(),
      type: "text",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      // Stop any current speech before processing new message
      if (voiceService.current.isCurrentlySpeaking?.()) {
        voiceService.current.stop();
      }

      // Evaluate the answer
      const evaluation = await geminiService.current.evaluateAnswer(
        currentQuestion.question,
        inputText,
        currentQuestion.correctAnswer
      );

      const evaluationMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: evaluation,
        sender: "bot",
        timestamp: new Date(),
        type: "text",
      };

      setMessages((prev) => [...prev, evaluationMessage]);

      // Update score
      if (evaluation.includes("Evaluation: Correct")) {
        setScore((prev) => ({
          ...prev,
          correct: prev.correct + 1,
          total: prev.total + 1,
        }));
      } else if (evaluation.includes("Evaluation: Incorrect")) {
        setScore((prev) => ({ ...prev, total: prev.total + 1 }));
      }

      await speakMessage(evaluation);

      // Generate new question after a brief delay
      setTimeout(() => {
        generateNewQuestion();
      }, 2000);
    } catch (error) {
      console.error("Error processing message:", error);
      message.error("Error evaluating answer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = async () => {
    if (!browserSupport.recognition) {
      message.warning("Speech recognition is not supported in your browser.");
      return;
    }

    try {
      // Stop any current speech before starting voice input
      if (voiceService.current.isCurrentlySpeaking?.()) {
        voiceService.current.stop();
        setIsSpeaking(false);
      }

      message.info("Listening... Speak now.");
      const transcript = await voiceService.current.startListening();

      if (transcript && transcript.trim()) {
        message.success("Voice input received");

        // Create user message directly
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          content: transcript,
          sender: "user",
          timestamp: new Date(),
          type: "text",
        };

        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
          // Stop any current speech before processing new message
          if (voiceService.current.isCurrentlySpeaking?.()) {
            voiceService.current.stop();
          }

          // Evaluate the answer
          const evaluation = await geminiService.current.evaluateAnswer(
            currentQuestion!.question,
            transcript,
            currentQuestion!.correctAnswer
          );

          const evaluationMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            content: evaluation,
            sender: "bot",
            timestamp: new Date(),
            type: "text",
          };

          setMessages((prev) => [...prev, evaluationMessage]);

          // Update score
          if (evaluation.includes("Evaluation: Correct")) {
            setScore((prev) => ({
              ...prev,
              correct: prev.correct + 1,
              total: prev.total + 1,
            }));
          } else if (evaluation.includes("Evaluation: Incorrect")) {
            setScore((prev) => ({ ...prev, total: prev.total + 1 }));
          }

          await speakMessage(evaluation);

          // Generate new question after a brief delay
          setTimeout(() => {
            generateNewQuestion();
          }, 2000);
        } catch (error) {
          console.error("Error processing voice message:", error);
          message.error("Error evaluating answer. Please try again.");
        } finally {
          setIsLoading(false);
        }
      } else {
        message.warning("No speech detected. Please try again.");
      }
    } catch (error) {
      console.error("Voice input error:", error);
      message.error("Error with voice input. Please try again.");
    }
  };

  const handleStopSpeaking = () => {
    voiceService.current.stop();
    setIsSpeaking(false);
    message.info("Speech stopped");
  };

  const startNewSession = async () => {
    // Stop any current speech
    if (voiceService.current.isCurrentlySpeaking?.()) {
      voiceService.current.stop();
      setIsSpeaking(false);
    }

    setMessages([]);
    setScore({ correct: 0, total: 0 });
    setCurrentQuestion(null);

    const welcomeMessage: ChatMessage = {
      id: "1",
      content:
        "Welcome to a new session! Let's start with your first question.",
      sender: "bot",
      timestamp: new Date(),
      type: "text",
    };
    setMessages([welcomeMessage]);

    await generateNewQuestion();
  };

  const testVoiceSettings = async () => {
    const testText = `This is a test of the ${voiceSettings.gender} voice with rate ${voiceSettings.rate} and pitch ${voiceSettings.pitch}.`;
    await speakMessage(testText);
  };

  const showDebugInfo = () => {
    const voices = voiceService.current.getAvailableVoices?.() || [];
    setAvailableVoices(
      voices.map(
        (v) => `${v.name} (${v.lang}) - ${v.localService ? "local" : "remote"}`
      )
    );
    setDebugVisible(true);
  };

  return (
    <div
      className="citizenship-chatbot"
      style={{ minHeight: "100vh", padding: "20px" }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Enhanced Header */}
        <div className="gradient-header">
          <Title
            level={1}
            style={{
              color: "white",
              margin: 0,
              textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
              fontSize: "2.5rem",
            }}
          >
            🇺🇸 US Citizenship Exam Preparation
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: "1.1rem" }}>
            Master your citizenship test with AI-powered practice
          </Text>
        </div>

        {/* Browser Support Alerts with better styling */}
        {!browserSupport.speech && (
          <Alert
            message="Text-to-speech not supported"
            description="Your browser doesn't support speech synthesis. Voice features will be disabled."
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{
              marginBottom: 16,
              borderRadius: "12px",
              border: "none",
              backgroundImage:
                "linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)",
            }}
          />
        )}

        {!browserSupport.recognition && (
          <Alert
            message="Speech recognition not supported"
            description="Your browser doesn't support speech recognition. Voice input will be disabled."
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{
              marginBottom: 16,
              borderRadius: "12px",
              border: "none",
              backgroundImage:
                "linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)",
            }}
          />
        )}

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card className="chat-container" bodyStyle={{ padding: 0 }}>
              <LipSyncFace
                isSpeaking={isSpeaking}
                text={
                  isSpeaking
                    ? "I'm asking you a question..."
                    : "Ready to help you practice!"
                }
              />

              {/* Enhanced Chat Messages Area */}
              <div
                className="chat-messages-container"
                style={{
                  height: 400,
                  overflowY: "auto",
                  margin: 16,
                  padding: 20,
                  backgroundImage:
                    "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                  borderRadius: "16px",
                  border: "2px solid #e9ecef",
                }}
              >
                <List
                  dataSource={messages}
                  renderItem={(message) => (
                    <List.Item
                      className={`chat-message-item ${
                        message.sender === "user"
                          ? "user-message-container"
                          : "bot-message-container"
                      }`}
                      style={{ border: "none", padding: "8px 0" }}
                    >
                      <div
                        className={`message-content-wrapper ${
                          message.sender === "user"
                            ? "user-message-wrapper"
                            : "bot-message-wrapper"
                        }`}
                        style={{ width: "100%" }}
                      >
                        <Avatar
                          size="large"
                          className="message-avatar"
                          icon={
                            message.sender === "user" ? (
                              <UserOutlined />
                            ) : (
                              <RobotOutlined />
                            )
                          }
                          style={{
                            backgroundImage:
                              message.sender === "user"
                                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                : "linear-gradient(135deg, #00b894 0%, #00a085 100%)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                          }}
                        />
                        <div
                          className={`message-text-content ${
                            message.sender === "user"
                              ? "user-text-content"
                              : "bot-text-content"
                          }`}
                        >
                          <div
                            className={`message-metadata ${
                              message.sender === "user"
                                ? "user-metadata"
                                : "bot-metadata"
                            }`}
                          >
                            <Text
                              strong
                              style={{
                                color:
                                  message.sender === "user"
                                    ? "#667eea"
                                    : "#00b894",
                                fontSize: "14px",
                              }}
                            >
                              {message.sender === "user"
                                ? "You"
                                : "Citizenship Tutor"}
                            </Text>
                            {message.metadata?.category && (
                              <span className="category-tag">
                                {message.metadata.category}
                              </span>
                            )}
                          </div>
                          <div
                            className={`message-bubble ${
                              message.sender === "user"
                                ? "user-message"
                                : "bot-message"
                            }`}
                          >
                            {message.content}
                          </div>
                          <Text
                            type="secondary"
                            style={{
                              fontSize: "11px",
                              display: "block",
                              marginTop: 4,
                              textAlign:
                                message.sender === "user" ? "right" : "left",
                            }}
                          >
                            {message.timestamp.toLocaleTimeString()}
                          </Text>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
                <div ref={messagesEndRef} />
              </div>

              {/* Enhanced Input Area */}
              <div className="chat-input-container">
                <Space.Compact style={{ width: "100%" }}>
                  <TextArea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your answer or click the microphone to speak..."
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    style={{
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      border: "2px solid #e9ecef",
                      fontSize: "16px",
                    }}
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={!currentQuestion || isLoading}
                  />
                  <Button
                    icon={<AudioOutlined />}
                    onClick={handleVoiceInput}
                    disabled={
                      isLoading ||
                      !browserSupport.recognition ||
                      !currentQuestion
                    }
                    loading={isLoading} // Add loading state
                    title={
                      !browserSupport.recognition
                        ? "Speech recognition not supported"
                        : "Voice input"
                    }
                    style={{
                      background: browserSupport.recognition
                        ? "linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)"
                        : "#f1f2f6",
                      border: "none",
                      color: "white",
                    }}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSendMessage}
                    loading={isLoading}
                    disabled={!currentQuestion}
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      border: "none",
                      fontWeight: "600",
                    }}
                  >
                    Send
                  </Button>
                </Space.Compact>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              className="settings-card"
              title={
                <span
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontWeight: "bold",
                  }}
                >
                  ⚙️ Settings & Progress
                </span>
              }
              style={{ marginBottom: 24 }}
            >
              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="middle"
              >
                {/* Voice Settings Section */}
                <div>
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    🎵 Voice Settings
                  </Text>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text>Enable Voice</Text>
                    <Switch
                      checked={voiceSettings.enabled && browserSupport.speech}
                      onChange={(checked) =>
                        setVoiceSettings((prev) => ({
                          ...prev,
                          enabled: checked,
                        }))
                      }
                      disabled={!browserSupport.speech}
                    />
                  </div>
                  {!browserSupport.speech && (
                    <Text
                      type="secondary"
                      style={{
                        display: "block",
                        fontSize: "12px",
                        marginTop: 4,
                      }}
                    >
                      Not supported in your browser
                    </Text>
                  )}
                </div>

                <div>
                  <Text style={{ display: "block", marginBottom: 8 }}>
                    Voice Gender
                  </Text>
                  <Select
                    value={voiceSettings.gender}
                    onChange={async (value: "male" | "female") => {
                      const newSettings = { ...voiceSettings, gender: value };
                      setVoiceSettings(newSettings);
                      if (newSettings.enabled && browserSupport.speech) {
                        try {
                          const testText =
                            value === "male"
                              ? "Hello, I am your male tutor"
                              : "Hello, I am your female tutor";
                          setIsSpeaking(true);
                          await voiceService.current.speak(
                            testText,
                            newSettings
                          );
                          message.success(`Switched to ${value} voice`);
                        } catch (error) {
                          console.error("Voice test failed:", error);
                          message.error("Voice test failed");
                        } finally {
                          setIsSpeaking(false);
                        }
                      }
                    }}
                    style={{ width: "100%" }}
                    disabled={!browserSupport.speech}
                  >
                    <Option value="female">👩 Female</Option>
                    <Option value="male">👨 Male</Option>
                  </Select>
                </div>

                <div>
                  <Text style={{ display: "block", marginBottom: 8 }}>
                    🎚️ Speech Rate: {voiceSettings.rate}x
                  </Text>
                  <Slider
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={voiceSettings.rate}
                    onChange={(value) =>
                      setVoiceSettings((prev) => ({ ...prev, rate: value }))
                    }
                    onAfterChange={() => testVoiceSettings()}
                    disabled={!browserSupport.speech}
                    trackStyle={{
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    }}
                  />
                </div>

                <div>
                  <Text style={{ display: "block", marginBottom: 8 }}>
                    🎵 Speech Pitch: {voiceSettings.pitch}
                  </Text>
                  <Slider
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={voiceSettings.pitch}
                    onChange={(value) =>
                      setVoiceSettings((prev) => ({ ...prev, pitch: value }))
                    }
                    onAfterChange={() => testVoiceSettings()}
                    disabled={!browserSupport.speech}
                    trackStyle={{
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    }}
                  />
                </div>

                <Button
                  className="voice-test-btn"
                  onClick={testVoiceSettings}
                  disabled={!browserSupport.speech || !voiceSettings.enabled}
                  block
                  size="large"
                >
                  🔊 Test Voice
                </Button>

                {isSpeaking && (
                  <Button
                    icon={<PauseOutlined />}
                    onClick={handleStopSpeaking}
                    danger
                    block
                  >
                    Stop Speaking
                  </Button>
                )}

                <Button
                  className="start-session-btn"
                  onClick={startNewSession}
                  block
                  size="large"
                >
                  🚀 Start New Session
                </Button>

                <Button
                  icon={<BugOutlined />}
                  onClick={showDebugInfo}
                  type="text"
                  size="small"
                >
                  Debug Voices
                </Button>
              </Space>
            </Card>

            {/* Enhanced Progress Card */}
            <Card
              className="progress-card"
              title={
                <span style={{ color: "white", fontWeight: "bold" }}>
                  📊 Your Progress
                </span>
              }
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Correct Answers"
                    value={score.correct}
                    valueStyle={{ color: "#ffd93d" }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Total Questions"
                    value={score.total}
                    valueStyle={{ color: "#74b9ff" }}
                  />
                </Col>
              </Row>
              {score.total > 0 && (
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  <div className="score-badge">
                    Score: {Math.round((score.correct / score.total) * 100)}%
                  </div>
                  {currentQuestion && (
                    <div style={{ marginTop: 12 }}>
                      <Text style={{ color: "rgba(255,255,255,0.9)" }}>
                        Current: {currentQuestion.category}
                      </Text>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        <Modal
          title="Voice Debug Information"
          open={debugVisible}
          onCancel={() => setDebugVisible(false)}
          footer={[
            <Button key="close" onClick={() => setDebugVisible(false)}>
              Close
            </Button>,
          ]}
          className="debug-modal"
          bodyStyle={{ maxHeight: "60vh", overflowY: "auto" }}
        >
          <div>
            <Text strong>Current Voice Settings:</Text>
            <pre
              style={{
                backgroundColor: "#f8f9fa",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e9ecef",
              }}
            >
              {JSON.stringify(voiceSettings, null, 2)}
            </pre>

            <Text strong>Available Voices ({availableVoices.length}):</Text>
            <ul
              className="voice-list"
              style={{
                maxHeight: "200px",
                overflow: "auto",
                backgroundColor: "#f8f9fa",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e9ecef",
                marginTop: "8px",
              }}
            >
              {availableVoices.map((voice, index) => (
                <li
                  key={index}
                  style={{
                    fontSize: "12px",
                    marginBottom: "4px",
                    padding: "4px 8px",
                    backgroundColor: "white",
                    borderRadius: "4px",
                    border: "1px solid #e9ecef",
                  }}
                >
                  {voice}
                </li>
              ))}
            </ul>

            <Text
              type="secondary"
              style={{ fontSize: "12px", display: "block", marginTop: "12px" }}
            >
              Note: Voice changes may take effect on the next speech utterance.
            </Text>
          </div>
        </Modal>
      </div>
    </div>
  );
};
