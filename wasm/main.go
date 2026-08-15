//go:build js && wasm

package main

import (
	"encoding/json"
	"syscall/js"
)

type WasmResponse struct {
	Success bool                `json:"success"`
	Results []*SimulationResult `json:"results,omitempty"`
	Error   string              `json:"error,omitempty"`
}

func runPathlengthSimulationWrapper(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return errorResponse("Missing input CSV parameter")
	}

	csvContent := args[0].String()
	debugMode := false
	if len(args) > 1 && args[1].Type() == js.TypeBoolean {
		debugMode = args[1].Bool()
	}

	results, err := RunAllSimulations(csvContent, debugMode)
	if err != nil {
		return errorResponse(err.Error())
	}

	resp := WasmResponse{
		Success: true,
		Results: results,
	}

	jsonBytes, err := json.Marshal(resp)
	if err != nil {
		return errorResponse("Failed to serialize results: " + err.Error())
	}

	return string(jsonBytes)
}

func errorResponse(msg string) string {
	resp := WasmResponse{
		Success: false,
		Error:   msg,
	}
	jsonBytes, _ := json.Marshal(resp)
	return string(jsonBytes)
}

func main() {
	c := make(chan struct{}, 0)
	js.Global().Set("runPathlengthSimulation", js.FuncOf(runPathlengthSimulationWrapper))
	js.Global().Set("__pathlengthWasmReady", true)
	<-c
}
