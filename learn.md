# Learning Guide for Training the Sign Language Model

## Prerequisites
1. **Python Environment**: Make sure you have Python installed. It is recommended to use virtual environments.
2. **Libraries**: Install the required libraries, including but not limited to:
   - TensorFlow or PyTorch
   - Keras
   - OpenCV
   - NumPY

## Folder Structure
This is the recommended folder structure for the project:
```
project_root/
├── ai-lab/
│   └── notebooks/
│       ├── sign_languagev2.ipynb
│       └── finetune_personal.ipynb
├── datasets/
│   ├── wlasl-processed/
│   └── asl-alphabet/
├── exports/
│   ├── model.onnx
│   └── model_meta.json
└── my_captures.json
``` 

## Step-by-Step Guide

### Step 1: Training the Sign Language Model
1. **Download the Kaggle Datasets**:
   - [WLASL Processed Dataset](https://www.kaggle.com/datasets/risangbaskoro/wlasl-processed)  
   - [ASL Alphabet Dataset](https://www.kaggle.com/datasets/grassknoted/asl-alphabet)
2. **Unzip and Place the Datasets** in the `datasets/` folder.
3. **Open the Notebook**: Launch `ai-lab/notebooks/sign_languagev2.ipynb`.
4. **Run the Cells** sequentially, ensuring your data paths are correct.
5. **Expected Output**: The model will be trained and saved. Look for the final model file, usually named `best_state.pt` in the outputs.

### Step 2: Fine-Tuning the Model
1. **Prepare your Captures**: Export your recordings as `my_captures.json` from the RecordMode UI.
2. **Open the Fine-Tuning Notebook**: Launch `ai-lab/notebooks/finetune_personal.ipynb`.
3. **Run the Cells** to fine-tune the same model with your custom captures.  
4. **Expected Output**: The fine-tuned model will weigh accordingly to give output results.

### Step 3: Exporting Model Artifacts
1. After training and fine-tuning, export your model to the ONNX format.
2. **Files to Export**: `model.onnx` and `model_meta.json` should be stored in `public/models`. 
3. **Commands to Execute**: Use appropriate API calls or functions to save your models.

## Troubleshooting
- **Requirement of `best_state.pt`**: Ensure that this file is created after training. If not, revisit your training logs for errors.
- **Catastrophic Forgetting**: Monitor validation loss/accuracy during training, and save checkpoints to avoid this issue.
- **ONNX Single-File Removal**: If facing issues, ensure you're exporting the model correctly as per ONNX requirements to avoid leaving deprecated .data files in the directory.

## Notes
- Use `SEQ_LENGTH=16` and `N_FEATURES=63` in model configurations to fit the requirements of your input signals and features count.
- Refine the parameters as needed based on the dataset to enhance model performance.

---