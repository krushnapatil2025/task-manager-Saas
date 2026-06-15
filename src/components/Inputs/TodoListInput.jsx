import React, { useState } from 'react';
import { HiMiniPlus, HiOutlineTrash } from 'react-icons/hi2';

const TodoListInput = ({ todoList = [], setTodoList }) => {
    const [option, setOption] = useState('');

    // Function to handle adding an option
    const handleAddOption = () => {
        if (option.trim()) {
            setTodoList([...(todoList || []), option.trim()]);
            setOption('');
        }
    };

    // Function to handle deleting an option
    const handleDeleteOption = (index) => {
        const updatedArr = (todoList || []).filter((_, idx) => idx !== index);
        setTodoList(updatedArr);
    };

    return (
        <div>
            {(todoList || []).map((item, index) => (
                <div
                    key={index}
                    className="flex justify-between bg-gray-50 border border-gray-100 px-4 py-2 rounded-md mb-3 mt-2"
                >
                    <p className="text-xs text-black">
                        <span className="text-xs text-gray-400 font-semibold mr-2">
                            {index < 9 ? `0${index + 1}` : index + 1}
                        </span>
                        {item}
                    </p>
                    <button
                        className="cursor-pointer"
                        onClick={() => handleDeleteOption(index)}
                    >
                        <HiOutlineTrash className="text-lg text-red-500" />
                    </button>
                </div>
            ))}
            <div className="flex items-center gap-5 mt-4">
                <input
                    type="text"
                    placeholder="Enter Task"
                    value={option}
                    onChange={({ target }) => setOption(target.value)}
                    className="text-[13px] text-black outline-none bg-white rounded-md px-3 py-2 border border-gray-200 focus:border-blue-500 transition"
                />
                <button className="card-btn text-nowrap" onClick={handleAddOption}>
                    <HiMiniPlus className="text-lg" /> Add
                </button>
            </div>
        </div>
    );
};

export default TodoListInput;
