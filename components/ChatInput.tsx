
import React, { useState, useRef } from 'react';
import { PaperClipIcon, MicrophoneIcon, PaperAirplaneIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (text: string, file?: File) => void;
  isSending: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isSending }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetInput = () => {
      setText('');
      setFile(null);
      setPreview(null);
      setFileType(null);
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
  }

  const handleSend = () => {
    if ((text.trim() || file) && !isSending) {
      onSendMessage(text, file || undefined);
      resetInput();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const type = selectedFile.type.split('/')[0];
      
      if (type === 'image' || type === 'video') {
        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setFileType(type);
      } else {
        // Handle other file types or show an error
        alert("Only images and videos are supported.");
      }
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className="p-3 bg-white border-t border-gray-200">
      {preview && (
        <div className="relative w-24 h-24 mb-2 p-1 border rounded">
          {fileType === 'image' && <img src={preview} alt="Preview" className="w-full h-full object-cover rounded" />}
          {fileType === 'video' && <video src={preview} className="w-full h-full object-cover rounded" />}
          <button
            onClick={() => {
              setPreview(null);
              setFile(null);
              setFileType(null);
               if(fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
            aria-label="Remove media preview"
          >
            &times;
          </button>
        </div>
      )}
      <div className="flex items-center">
        <div className="flex space-x-1 text-gray-500">
          <button className="p-2 rounded-full hover:bg-gray-200">
            <MicrophoneIcon className="w-6 h-6" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,video/*"
          />
          <button onClick={handleAttachClick} className="p-2 rounded-full hover:bg-gray-200">
            <PaperClipIcon className="w-6 h-6" />
          </button>
        </div>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 mx-3 bg-gray-100 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSending}
        />
        <button
          onClick={handleSend}
          disabled={isSending || (!text.trim() && !file)}
          className="p-2 rounded-full bg-blue-500 text-white disabled:bg-gray-300 transition-colors duration-200"
          aria-label="Send message"
        >
          <PaperAirplaneIcon className="w-6 h-6 transform rotate-90" />
        </button>
      </div>
    </div>
  );
};
